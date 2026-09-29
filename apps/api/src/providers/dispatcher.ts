import {
  IncidentType,
  ResponseServiceType,
  Severity,
  type Incident,
  type PrismaClient
} from "@prisma/client";

export function classifyResponse(type: IncidentType) {
  if (type === IncidentType.POTENTIAL_DROWNING || type === IncidentType.PERSON_OVERBOARD) return ResponseServiceType.WATER_RESCUE;
  if (type === IncidentType.SEARCH_TARGET || type === IncidentType.CHILD_RISK) return ResponseServiceType.SEARCH_RESCUE;
  if (type === IncidentType.RESTRICTED_ZONE) return ResponseServiceType.TECHNICAL_SERVICE;
  return ResponseServiceType.WATER_RESCUE;
}

export async function analyzeIncident(prisma: PrismaClient, incident: Incident) {
  const recommendedType = classifyResponse(incident.type);
  const nearest = await prisma.responseService.findFirst({
    where: { type: recommendedType, status: "AVAILABLE" },
    orderBy: { createdAt: "asc" }
  });

  return {
    source: "Dispatcher",
    type: incident.type,
    severity: incident.severity ?? Severity.HIGH,
    location: `Sector 04 · ${incident.latitude.toFixed(4)}, ${incident.longitude.toFixed(4)}`,
    evidence: `Drone Boltzzmann-01 / frame 18:42:31`,
    recommendedResponse: recommendedType,
    nearestResponder: nearest?.name ?? "RESCUE-1",
    requiresOperatorConfirmation: true
  };
}

export async function createEvidencePackage(prisma: PrismaClient, incidentId: string) {
  const incident = await prisma.incident.findUniqueOrThrow({
    where: { id: incidentId },
    include: { drone: true, events: { orderBy: { createdAt: "asc" } }, assignments: { include: { rescuer: true } } }
  });
  const existing = await prisma.evidence.findFirst({ where: { incidentId: incident.id }, include: { assets: true, incident: true } });
  if (existing) return existing;

  const publicId = `EV-${incident.publicId}`;
  const reportHtml = [
    `<h1>Boltzzmann EMERGENCY REPORT</h1>`,
    `<p><strong>INCIDENT</strong> ${incident.publicId}</p>`,
    `<p><strong>TYPE</strong> ${incident.type}</p>`,
    `<p><strong>SEVERITY</strong> ${incident.severity}</p>`,
    `<p><strong>LOCATION</strong> ${incident.latitude.toFixed(5)}, ${incident.longitude.toFixed(5)}</p>`,
    `<p><strong>DRONE</strong> ${incident.drone?.name ?? "Boltzzmann-01"}</p>`,
    `<p><strong>AI CONFIDENCE</strong> ${incident.confidence}%</p>`
  ].join("");

  const evidence = await prisma.evidence.create({
    data: {
      publicId,
      incidentId: incident.id,
      reportHtml,
      qrPayload: `/evidence?incident=${incident.publicId}`,
      metadata: {
        service: "Boltzzmann evidence service",
        source: "database",
        status: incident.status
      },
      assets: {
        create: [
          {
            type: "DETECTION_SCREENSHOT",
            label: "AI detection frame",
            url: "/media/coast-highlight.png",
            metadata: { confidence: incident.confidence }
          },
          {
            type: "VIDEO_CLIP",
            label: "Playback clip reference",
            url: "/media/coast-original.png",
            metadata: { offsetSec: 660 }
          }
        ]
      }
    },
    include: { assets: true, incident: true }
  });
  return evidence;
}

export async function queuePrintJob(prisma: PrismaClient, incidentId: string) {
  const existing = await prisma.printJob.findFirst({ where: { incidentId }, orderBy: { createdAt: "desc" } });
  if (existing) return existing;

  const queued = await prisma.printJob.create({
    data: {
      incidentId,
      status: "QUEUED",
      metadata: { provider: "PrintQueue", station: "Спасательная станция 7А" }
    }
  });
  const printing = await prisma.printJob.update({ where: { id: queued.id }, data: { status: "PRINTING" } });
  return prisma.printJob.update({
    where: { id: printing.id },
    data: { status: "PRINTED", printedAt: new Date(), reportUrl: `/evidence?job=${printing.id}` }
  });
}
