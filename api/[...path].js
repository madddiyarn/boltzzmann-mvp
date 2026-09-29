// apps/api/src/lib/env.ts
import { config } from "dotenv";
config({ path: ".env.local" });
config();
var env = {
  port: Number(process.env.PORT ?? 4100),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173"
};

// apps/api/src/index.ts
import cors from "cors";
import express from "express";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { z } from "zod";
import { AssignmentStatus, CandidateStatus, ConnectionMethod, ConnectionStatus, DroneStatus, IncidentStatus, IncidentType as IncidentType2, PatrolStatus, RescuerStatus } from "@prisma/client";

// apps/api/src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
var prisma = new PrismaClient();

// apps/api/src/providers/dispatcher.ts
import {
  IncidentType,
  ResponseServiceType,
  Severity
} from "@prisma/client";
async function createEvidencePackage(prisma2, incidentId) {
  const incident = await prisma2.incident.findUniqueOrThrow({
    where: { id: incidentId },
    include: { drone: true, events: { orderBy: { createdAt: "asc" } }, assignments: { include: { rescuer: true } } }
  });
  const existing = await prisma2.evidence.findFirst({ where: { incidentId: incident.id }, include: { assets: true, incident: true } });
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
  const evidence = await prisma2.evidence.create({
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

// apps/api/src/providers/environment.ts
import { DataSourceKind } from "@prisma/client";
async function getCurrentEnvironmentalSnapshot(prisma2) {
  const existing = await prisma2.environmentalSnapshot.findFirst({ orderBy: { validAt: "desc" } });
  if (existing) return existing;
  return prisma2.environmentalSnapshot.create({
    data: {
      sourceKind: DataSourceKind.SIMULATED,
      windSpeed: 8.4,
      windDirection: 286,
      temperature: 24.2,
      visibility: 9.5,
      precipitation: 0,
      weatherStatus: "\u042F\u0441\u043D\u043E, simulated",
      waveHeight: 1.2,
      wavePeriod: 5.8,
      waveDirection: 301,
      currentSpeed: 0.34,
      currentDirection: 312,
      droneCondition: "NORMAL",
      rescueCondition: "ELEVATED",
      explanation: "SIMULATED: \u0434\u0435\u043C\u043E-\u043F\u043E\u0440\u043E\u0433. \u0412\u0435\u0442\u0435\u0440 \u0438 \u0432\u043E\u043B\u043D\u0430 \u0443\u043C\u0435\u0440\u0435\u043D\u043D\u044B\u0435, \u0441\u043F\u0430\u0441\u0430\u0442\u0435\u043B\u044C\u043D\u044B\u0435 \u043E\u043F\u0435\u0440\u0430\u0446\u0438\u0438 \u0442\u0440\u0435\u0431\u0443\u044E\u0442 \u043F\u043E\u0432\u044B\u0448\u0435\u043D\u043D\u043E\u0433\u043E \u0432\u043D\u0438\u043C\u0430\u043D\u0438\u044F.",
      validAt: /* @__PURE__ */ new Date()
    }
  });
}
function buildSeaForecast(base) {
  return [
    { label: "NOW", windSpeed: base.windSpeed, waveHeight: base.waveHeight, sourceKind: base.sourceKind },
    { label: "+1H", windSpeed: +(base.windSpeed + 0.6).toFixed(1), waveHeight: +(base.waveHeight + 0.1).toFixed(1), sourceKind: DataSourceKind.SIMULATED },
    { label: "+3H", windSpeed: +(base.windSpeed + 1.4).toFixed(1), waveHeight: +(base.waveHeight + 0.3).toFixed(1), sourceKind: DataSourceKind.SIMULATED },
    { label: "+6H", windSpeed: +(base.windSpeed + 0.9).toFixed(1), waveHeight: +(base.waveHeight + 0.2).toFixed(1), sourceKind: DataSourceKind.SIMULATED }
  ];
}

// apps/api/src/providers/drift.ts
function projectPoint(latitude, longitude, bearingDeg, meters) {
  const rad = bearingDeg * Math.PI / 180;
  const dLat = Math.cos(rad) * meters / 111320;
  const dLon = Math.sin(rad) * meters / (111320 * Math.cos(latitude * Math.PI / 180));
  return { latitude: +(latitude + dLat).toFixed(6), longitude: +(longitude + dLon).toFixed(6) };
}
function calculateDriftAreas(input) {
  const combinedDirection = Math.round((input.snapshot.windDirection * 0.55 + input.snapshot.currentDirection * 0.45) % 360);
  const baseSpeedMetersPerMinute = input.snapshot.currentSpeed * 60 + input.snapshot.windSpeed * 0.018;
  return [0, 5, 10, 20].map((offset) => {
    const minutes = input.elapsedMinutes + offset;
    const distance = baseSpeedMetersPerMinute * minutes;
    const point = projectPoint(input.latitude, input.longitude, combinedDirection, distance);
    return {
      label: offset === 0 ? "NOW" : `+${offset} MIN`,
      ...point,
      radius: Math.round(120 + minutes * 14 + input.snapshot.waveHeight * 35)
    };
  });
}
async function createDriftPrediction(prisma2, input) {
  const areas = calculateDriftAreas(input);
  return prisma2.driftPrediction.create({
    data: {
      incidentId: input.incidentId,
      searchMissionId: input.searchMissionId,
      environmentalSnapshotId: input.snapshot.id,
      originLatitude: input.latitude,
      originLongitude: input.longitude,
      elapsedMinutes: input.elapsedMinutes,
      areas,
      metadata: {
        model: "drift-estimate",
        note: "Estimated search area, not an exact scientific prediction."
      }
    }
  });
}

// apps/api/src/index.ts
var app = express();
var httpServer = createServer(app);
var io = new Server(httpServer, {
  cors: { origin: "*" }
});
app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "50mb" }));
var asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
function routeParam(value) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
function hashPassword(password) {
  return createHash("sha256").update(password).digest("hex");
}
function publicUser(user) {
  const { passwordHash: _passwordHash, ...safeUser } = user;
  return safeUser;
}
async function getOverview() {
  const [drones, incidents, zones, rescuers, patrols, missions, detections, events, telemetry, activeConnection, sea, driftPredictions, sightings] = await Promise.all([
    prisma.drone.findMany({ orderBy: { name: "asc" } }),
    prisma.incident.findMany({
      orderBy: { createdAt: "desc" },
      include: { drone: true, patrol: true, events: { orderBy: { createdAt: "asc" } }, assignments: { include: { rescuer: true } } }
    }),
    prisma.zone.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.rescuer.findMany({ orderBy: { callSign: "asc" } }),
    prisma.patrol.findMany({ orderBy: { createdAt: "desc" }, include: { drone: true, detections: true, incidents: true } }),
    prisma.searchMission.findMany({ orderBy: { createdAt: "desc" }, include: { candidates: true, sightings: { orderBy: { timestamp: "asc" } }, driftPredictions: { orderBy: { createdAt: "desc" }, take: 1 } } }),
    prisma.detection.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.incidentEvent.findMany({ orderBy: { createdAt: "desc" }, take: 12, include: { incident: true } }),
    prisma.droneTelemetry.findMany({ orderBy: { createdAt: "desc" }, take: 40, include: { drone: true } }),
    prisma.droneConnection.findFirst({ where: { status: "CONNECTED" }, orderBy: { connectedAt: "desc" }, include: { drone: true } }),
    getCurrentEnvironmentalSnapshot(prisma),
    prisma.driftPrediction.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
    prisma.targetSighting.findMany({ orderBy: { timestamp: "asc" }, take: 12 })
  ]);
  return {
    drones,
    incidents,
    zones,
    rescuers,
    patrols,
    missions,
    detections,
    events,
    telemetry,
    activeConnection,
    sea,
    seaForecast: buildSeaForecast(sea),
    driftPredictions,
    sightings,
    stats: {
      activeDrones: drones.filter((drone) => drone.status === "ONLINE").length,
      activeIncidents: incidents.filter((incident) => !["RESOLVED", "FALSE_ALARM"].includes(incident.status)).length,
      availableRescuers: rescuers.filter((rescuer) => rescuer.status === "AVAILABLE").length,
      patrolsToday: patrols.length
    }
  };
}
async function nextPublicId(prefix) {
  const count = await prisma.incident.count();
  return `${prefix}-${String(count + 1).padStart(4, "0")}`;
}
async function dispatchIncident(incidentId) {
  const incident = await prisma.incident.findUniqueOrThrow({ where: { id: incidentId } });
  const rescuer = await prisma.rescuer.findFirst({
    where: { status: RescuerStatus.AVAILABLE },
    orderBy: { callSign: "asc" }
  });
  if (!rescuer) {
    throw new Error("\u041D\u0435\u0442 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u044B\u0445 \u0441\u043F\u0430\u0441\u0430\u0442\u0435\u043B\u0435\u0439 \u0434\u043B\u044F dispatch");
  }
  const assignment = await prisma.rescueAssignment.create({
    data: {
      incidentId: incident.id,
      rescuerId: rescuer.id,
      status: AssignmentStatus.SENT
    },
    include: { incident: true, rescuer: true }
  });
  await prisma.incident.update({
    where: { id: incident.id },
    data: { status: IncidentStatus.DISPATCHED }
  });
  await prisma.rescuer.update({
    where: { id: rescuer.id },
    data: { status: RescuerStatus.DISPATCHED }
  });
  await prisma.incidentEvent.create({
    data: {
      incidentId: incident.id,
      type: "DISPATCH",
      message: `\u0421\u043F\u0430\u0441\u0430\u0442\u0435\u043B\u044C ${rescuer.callSign} \u043D\u0430\u043F\u0440\u0430\u0432\u043B\u0435\u043D \u043A \u043A\u043E\u043E\u0440\u0434\u0438\u043D\u0430\u0442\u0430\u043C`
    }
  });
  io.emit("incident.dispatched", assignment);
  io.emit("rescue.assigned", assignment);
  io.emit("dashboard:update");
  return assignment;
}
async function applyRescueAction(assignmentId, action) {
  const assignment = await prisma.rescueAssignment.findUniqueOrThrow({ where: { id: assignmentId }, include: { incident: true, rescuer: true } });
  const now = /* @__PURE__ */ new Date();
  const status = action === "ACCEPT" ? AssignmentStatus.ACCEPTED : action === "ARRIVED" ? AssignmentStatus.ARRIVED : AssignmentStatus.COMPLETED;
  const incidentStatus = action === "ACCEPT" ? IncidentStatus.RESCUER_ACCEPTED : action === "ARRIVED" ? IncidentStatus.ARRIVED : IncidentStatus.RESOLVED;
  await prisma.rescueAssignment.update({
    where: { id: assignment.id },
    data: {
      status,
      acceptedAt: action === "ACCEPT" ? now : assignment.acceptedAt,
      arrivedAt: action === "ARRIVED" ? now : assignment.arrivedAt,
      completedAt: action === "RESCUED" ? now : assignment.completedAt
    },
    include: { incident: true, rescuer: true }
  });
  await prisma.incident.update({ where: { id: assignment.incidentId }, data: { status: incidentStatus, resolvedAt: action === "RESCUED" ? now : void 0 } });
  await prisma.incidentEvent.create({
    data: {
      incidentId: assignment.incidentId,
      type: "RESCUE",
      message: action === "ACCEPT" ? "18:43:02 \u0421\u043F\u0430\u0441\u0430\u0442\u0435\u043B\u044C \u043F\u0440\u0438\u043D\u044F\u043B \u0432\u044B\u0437\u043E\u0432" : action === "ARRIVED" ? "18:47:10 \u0421\u043F\u0430\u0441\u0430\u0442\u0435\u043B\u044C \u043F\u0440\u0438\u0431\u044B\u043B \u043A \u043A\u043E\u043E\u0440\u0434\u0438\u043D\u0430\u0442\u0430\u043C" : "18:49:26 \u041F\u043E\u0441\u0442\u0440\u0430\u0434\u0430\u0432\u0448\u0438\u0439 \u0441\u043F\u0430\u0441\u0435\u043D, \u0438\u043D\u0446\u0438\u0434\u0435\u043D\u0442 \u0437\u0430\u043A\u0440\u044B\u0442"
    }
  });
  if (action === "RESCUED") {
    await prisma.rescuer.update({ where: { id: assignment.rescuerId }, data: { status: RescuerStatus.AVAILABLE } });
  }
  const updated = await prisma.rescueAssignment.findUniqueOrThrow({
    where: { id: assignment.id },
    include: { incident: true, rescuer: true }
  });
  const realtimeEvent = action === "ACCEPT" ? "rescue.accepted" : action === "ARRIVED" ? "rescue.arrived" : "rescue.completed";
  io.emit("rescue:update", updated);
  io.emit(realtimeEvent, updated);
  if (action === "RESCUED") io.emit("incident.resolved", updated.incident);
  io.emit("dashboard:update");
  return updated;
}
app.get("/api/health", asyncRoute(async (_req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ ok: true, database: "connected" });
}));
app.post("/api/auth/login", asyncRoute(async (req, res) => {
  const input = z.object({
    email: z.string().email(),
    password: z.string().min(1)
  }).parse(req.body);
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (!user || user.passwordHash !== hashPassword(input.password)) {
    res.status(401).json({ message: "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 email \u0438\u043B\u0438 \u043F\u0430\u0440\u043E\u043B\u044C" });
    return;
  }
  res.json({ user: publicUser(user) });
}));
app.get("/api/admin/snapshot", asyncRoute(async (_req, res) => {
  const [users, drones, rescuers, recordings] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.drone.findMany({ orderBy: { name: "asc" } }),
    prisma.rescuer.findMany({ orderBy: { callSign: "asc" } }),
    prisma.recording.findMany({ orderBy: { createdAt: "desc" }, include: { drone: true, events: { orderBy: { offsetSec: "asc" } }, changes: true } })
  ]);
  res.json({ users: users.map(publicUser), drones, rescuers, recordings });
}));
app.post("/api/admin/users", asyncRoute(async (req, res) => {
  const input = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    role: z.enum(["SUPERVISOR", "CONTROLLER"]),
    password: z.string().min(6)
  }).parse(req.body);
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email.toLowerCase(),
      role: input.role,
      passwordHash: hashPassword(input.password)
    }
  });
  io.emit("dashboard:update");
  res.json(publicUser(user));
}));
app.put("/api/admin/users/:id", asyncRoute(async (req, res) => {
  const input = z.object({
    name: z.string().min(2),
    email: z.string().email(),
    role: z.enum(["SUPERVISOR", "CONTROLLER"]),
    password: z.string().min(6).optional().or(z.literal(""))
  }).parse(req.body);
  const data = {
    name: input.name,
    email: input.email.toLowerCase(),
    role: input.role
  };
  if (input.password) data.passwordHash = hashPassword(input.password);
  const user = await prisma.user.update({ where: { id: routeParam(req.params.id) }, data });
  io.emit("dashboard:update");
  res.json(publicUser(user));
}));
app.delete("/api/admin/users/:id", asyncRoute(async (req, res) => {
  const id = routeParam(req.params.id);
  const user = await prisma.user.findUniqueOrThrow({ where: { id } });
  if (user.role === "CONTROLLER") {
    const controllers = await prisma.user.count({ where: { role: "CONTROLLER" } });
    if (controllers <= 1) {
      res.status(400).json({ message: "\u041D\u0435\u043B\u044C\u0437\u044F \u0443\u0434\u0430\u043B\u0438\u0442\u044C \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u0433\u043E \u043A\u043E\u043D\u0442\u0440\u043E\u043B\u043B\u0435\u0440\u0430" });
      return;
    }
  }
  await prisma.user.delete({ where: { id } });
  io.emit("dashboard:update");
  res.json({ ok: true });
}));
app.post("/api/admin/drones", asyncRoute(async (req, res) => {
  const input = z.object({
    serialNumber: z.string().min(2),
    name: z.string().min(2),
    model: z.string().min(2),
    status: z.nativeEnum(DroneStatus).default(DroneStatus.OFFLINE),
    battery: z.number().min(0).max(100).default(100),
    latitude: z.number(),
    longitude: z.number(),
    altitude: z.number().default(0),
    station: z.string().optional(),
    mission: z.string().optional()
  }).parse(req.body);
  const drone = await prisma.drone.create({ data: { ...input, gpsStatus: "READY", cameraStatus: "ONLINE" } });
  io.emit("dashboard:update");
  res.json(drone);
}));
app.put("/api/admin/drones/:id", asyncRoute(async (req, res) => {
  const input = z.object({
    serialNumber: z.string().min(2),
    name: z.string().min(2),
    model: z.string().min(2),
    status: z.nativeEnum(DroneStatus),
    battery: z.number().min(0).max(100),
    latitude: z.number(),
    longitude: z.number(),
    altitude: z.number(),
    station: z.string().optional().nullable(),
    mission: z.string().optional().nullable()
  }).parse(req.body);
  const drone = await prisma.drone.update({ where: { id: routeParam(req.params.id) }, data: { ...input, lastSeenAt: /* @__PURE__ */ new Date() } });
  io.emit("dashboard:update");
  res.json(drone);
}));
app.delete("/api/admin/drones/:id", asyncRoute(async (req, res) => {
  await prisma.drone.delete({ where: { id: routeParam(req.params.id) } });
  io.emit("dashboard:update");
  res.json({ ok: true });
}));
app.post("/api/admin/rescuers", asyncRoute(async (req, res) => {
  const input = z.object({
    name: z.string().min(2),
    callSign: z.string().min(2),
    status: z.nativeEnum(RescuerStatus).default(RescuerStatus.AVAILABLE),
    latitude: z.number(),
    longitude: z.number()
  }).parse(req.body);
  const rescuer = await prisma.rescuer.create({ data: input });
  io.emit("dashboard:update");
  res.json(rescuer);
}));
app.put("/api/admin/rescuers/:id", asyncRoute(async (req, res) => {
  const input = z.object({
    name: z.string().min(2),
    callSign: z.string().min(2),
    status: z.nativeEnum(RescuerStatus),
    latitude: z.number(),
    longitude: z.number()
  }).parse(req.body);
  const rescuer = await prisma.rescuer.update({ where: { id: routeParam(req.params.id) }, data: input });
  io.emit("dashboard:update");
  res.json(rescuer);
}));
app.delete("/api/admin/rescuers/:id", asyncRoute(async (req, res) => {
  await prisma.rescuer.delete({ where: { id: routeParam(req.params.id) } });
  io.emit("dashboard:update");
  res.json({ ok: true });
}));
app.post("/api/admin/recordings", asyncRoute(async (req, res) => {
  const input = z.object({
    droneId: z.string(),
    mission: z.string().min(2),
    videoUrl: z.string().min(4),
    startedAt: z.string(),
    endedAt: z.string(),
    metadata: z.record(z.string(), z.unknown()).default({})
  }).parse(req.body);
  const count = await prisma.recording.count();
  const recording = await prisma.recording.create({
    data: {
      publicId: `REC-${String(count + 1).padStart(4, "0")}`,
      droneId: input.droneId,
      mission: input.mission,
      videoUrl: input.videoUrl,
      startedAt: new Date(input.startedAt),
      endedAt: new Date(input.endedAt),
      metadata: input.metadata
    },
    include: { drone: true, events: true, changes: true }
  });
  io.emit("dashboard:update");
  res.json(recording);
}));
app.delete("/api/admin/recordings/:id", asyncRoute(async (req, res) => {
  await prisma.recording.delete({ where: { id: routeParam(req.params.id) } });
  io.emit("dashboard:update");
  res.json({ ok: true });
}));
app.get("/api/connections/active", asyncRoute(async (_req, res) => {
  const active = await prisma.droneConnection.findFirst({
    where: { status: ConnectionStatus.CONNECTED },
    orderBy: { connectedAt: "desc" },
    include: { drone: true }
  });
  res.json(active);
}));
app.post("/api/connections/connect", asyncRoute(async (req, res) => {
  const input = z.object({
    model: z.string().min(2),
    method: z.nativeEnum(ConnectionMethod),
    serialNumber: z.string().min(1).optional()
  }).parse(req.body);
  const serialNumber = input.serialNumber?.trim() || `OPS-${input.model.toUpperCase().replace(/[^A-Z0-9]+/g, "-")}-${Date.now().toString().slice(-4)}`;
  await prisma.droneConnection.updateMany({
    where: { status: ConnectionStatus.CONNECTED },
    data: { status: ConnectionStatus.DISCONNECTED, disconnectedAt: /* @__PURE__ */ new Date() }
  });
  const count = await prisma.drone.count();
  const drone = await prisma.drone.upsert({
    where: { serialNumber },
    update: {
      model: input.model,
      status: "ONLINE",
      battery: 87,
      gpsStatus: "READY",
      cameraStatus: "ONLINE",
      latitude: 43.6509,
      longitude: 51.1406,
      altitude: 82,
      lastSeenAt: /* @__PURE__ */ new Date()
    },
    create: {
      serialNumber,
      name: count === 0 ? "Boltzzmann-01" : `Boltzzmann-${String(count + 1).padStart(2, "0")}`,
      model: input.model,
      status: "ONLINE",
      battery: 87,
      gpsStatus: "READY",
      cameraStatus: "ONLINE",
      latitude: 43.6509,
      longitude: 51.1406,
      altitude: 82,
      station: "\u0421\u043F\u0430\u0441\u0430\u0442\u0435\u043B\u044C\u043D\u0430\u044F \u0441\u0442\u0430\u043D\u0446\u0438\u044F 7\u0410",
      mission: "\u041E\u043F\u0435\u0440\u0430\u0446\u0438\u043E\u043D\u043D\u0430\u044F \u0441\u0435\u0441\u0441\u0438\u044F"
    }
  });
  const connection = await prisma.droneConnection.create({
    data: {
      droneId: drone.id,
      method: input.method,
      status: ConnectionStatus.CONNECTED,
      isMock: false,
      selectedModel: input.model,
      serialNumber,
      metadata: {
        label: "OPERATIONAL CONNECTION",
        flow: input.method === ConnectionMethod.DJI_APP ? ["\u041F\u043E\u0438\u0441\u043A \u0443\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u0430", "\u0423\u0441\u0442\u0440\u043E\u0439\u0441\u0442\u0432\u043E \u043D\u0430\u0439\u0434\u0435\u043D\u043E", "\u0423\u0441\u0442\u0430\u043D\u043E\u0432\u043A\u0430 \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u044F", "\u041F\u043E\u043B\u0443\u0447\u0435\u043D\u0438\u0435 \u0442\u0435\u043B\u0435\u043C\u0435\u0442\u0440\u0438\u0438", "\u0421\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u044F \u043A\u0430\u043C\u0435\u0440\u044B", "\u041F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u043E"] : []
      }
    },
    include: { drone: true }
  });
  io.emit("drone.connected", connection);
  io.emit("dashboard:update");
  res.json(connection);
}));
app.post("/api/connections/disconnect", asyncRoute(async (_req, res) => {
  const result = await prisma.droneConnection.updateMany({
    where: { status: ConnectionStatus.CONNECTED },
    data: { status: ConnectionStatus.DISCONNECTED, disconnectedAt: /* @__PURE__ */ new Date() }
  });
  io.emit("drone.disconnected", result);
  io.emit("dashboard:update");
  res.json({ ok: true, disconnected: result.count });
}));
app.get("/api/overview", asyncRoute(async (_req, res) => {
  res.json(await getOverview());
}));
app.get("/api/incidents", asyncRoute(async (_req, res) => {
  const incidents = await prisma.incident.findMany({
    orderBy: { createdAt: "desc" },
    include: { drone: true, events: { orderBy: { createdAt: "asc" } }, assignments: { include: { rescuer: true } } }
  });
  res.json(incidents);
}));
app.get("/api/incidents/:id", asyncRoute(async (req, res) => {
  const incident = await prisma.incident.findUniqueOrThrow({
    where: { id: routeParam(req.params.id) },
    include: { drone: true, events: { orderBy: { createdAt: "asc" } }, assignments: { include: { rescuer: true } } }
  });
  res.json(incident);
}));
app.post("/api/incidents/:id/dispatch", asyncRoute(async (req, res) => {
  res.json(await dispatchIncident(routeParam(req.params.id)));
}));
app.post("/api/incidents", asyncRoute(async (req, res) => {
  const input = z.object({
    type: z.enum(["POTENTIAL_DROWNING", "SAFE_ZONE_VIOLATION", "RESTRICTED_ZONE", "PERSON_OVERBOARD", "CHILD_RISK", "FISHERMAN_SAFETY", "SEARCH_TARGET"]),
    status: z.enum(["NEW", "CONFIRMED", "DISPATCHED", "RESCUER_ACCEPTED", "ARRIVED", "RESOLVED", "FALSE_ALARM"]).default("NEW"),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
    confidence: z.number().int().min(0).max(100).default(75),
    latitude: z.number(),
    longitude: z.number(),
    droneId: z.string().optional(),
    message: z.string().optional()
  }).parse(req.body);
  const incident = await prisma.incident.create({
    data: {
      publicId: await nextPublicId("INC"),
      type: input.type,
      status: input.status,
      severity: input.severity ?? (input.confidence >= 85 ? "CRITICAL" : input.confidence >= 70 ? "HIGH" : "MEDIUM"),
      confidence: input.confidence,
      latitude: input.latitude,
      longitude: input.longitude,
      droneId: input.droneId || void 0,
      confirmedAt: input.status === IncidentStatus.CONFIRMED ? /* @__PURE__ */ new Date() : void 0,
      resolvedAt: [IncidentStatus.RESOLVED, IncidentStatus.FALSE_ALARM].includes(input.status) ? /* @__PURE__ */ new Date() : void 0,
      events: {
        create: {
          type: "CREATED",
          message: input.message ?? "\u0418\u043D\u0446\u0438\u0434\u0435\u043D\u0442 \u0441\u043E\u0437\u0434\u0430\u043D \u043E\u043F\u0435\u0440\u0430\u0442\u043E\u0440\u043E\u043C"
        }
      }
    },
    include: { drone: true, events: { orderBy: { createdAt: "asc" } }, assignments: { include: { rescuer: true } } }
  });
  io.emit("incident:created", incident);
  io.emit("dashboard:update");
  res.json(incident);
}));
app.post("/api/incidents/:id/status", asyncRoute(async (req, res) => {
  const input = z.object({ status: z.nativeEnum(IncidentStatus), message: z.string().optional() }).parse(req.body);
  const data = {
    status: input.status,
    confirmedAt: input.status === IncidentStatus.CONFIRMED ? /* @__PURE__ */ new Date() : void 0,
    resolvedAt: [IncidentStatus.RESOLVED, IncidentStatus.FALSE_ALARM].includes(input.status) ? /* @__PURE__ */ new Date() : void 0
  };
  const incident = await prisma.incident.update({ where: { id: routeParam(req.params.id) }, data });
  await prisma.incidentEvent.create({
    data: { incidentId: incident.id, type: "STATUS", message: input.message ?? `\u0421\u0442\u0430\u0442\u0443\u0441 \u0438\u0437\u043C\u0435\u043D\u0435\u043D \u043D\u0430 ${input.status}` }
  });
  io.emit("incident:updated", incident);
  io.emit("dashboard:update");
  res.json(incident);
}));
app.post("/api/drones/connect", asyncRoute(async (req, res) => {
  const input = z.object({
    serialNumber: z.string().min(1),
    name: z.string().min(2).optional(),
    station: z.string().min(2).optional(),
    model: z.string().optional()
  }).parse(req.body);
  const allowed = {
    "AVATA2-OPS-001": { model: "DJI Avata 2", battery: 87 },
    "M3E-OPS-002": { model: "DJI Mavic 3 Enterprise", battery: 42 },
    "M30-OPS-003": { model: "DJI Matrice 30", battery: 12 }
  };
  const profile = allowed[input.serialNumber] ?? { model: input.model ?? "Other Drone", battery: 87 };
  const drone = await prisma.drone.upsert({
    where: { serialNumber: input.serialNumber },
    update: {
      name: input.name ?? "Boltzzmann-01",
      model: profile.model,
      station: input.station ?? "\u0421\u043F\u0430\u0441\u0430\u0442\u0435\u043B\u044C\u043D\u0430\u044F \u0441\u0442\u0430\u043D\u0446\u0438\u044F 7\u0410",
      status: "ONLINE",
      battery: profile.battery,
      gpsStatus: "READY",
      cameraStatus: "ONLINE",
      latitude: 43.6509,
      longitude: 51.1406,
      altitude: 82,
      lastSeenAt: /* @__PURE__ */ new Date()
    },
    create: {
      serialNumber: input.serialNumber,
      name: input.name ?? "Boltzzmann-01",
      model: profile.model,
      station: input.station ?? "\u0421\u043F\u0430\u0441\u0430\u0442\u0435\u043B\u044C\u043D\u0430\u044F \u0441\u0442\u0430\u043D\u0446\u0438\u044F 7\u0410",
      status: "ONLINE",
      battery: profile.battery,
      gpsStatus: "READY",
      cameraStatus: "ONLINE",
      latitude: 43.6509,
      longitude: 51.1406,
      altitude: 82
    }
  });
  io.emit("drone:connected", drone);
  res.json(drone);
}));
app.get("/api/sea", asyncRoute(async (_req, res) => {
  const snapshot = await getCurrentEnvironmentalSnapshot(prisma);
  res.json({ snapshot, forecast: buildSeaForecast(snapshot), source: "MarineProvider" });
}));
app.post("/api/drift", asyncRoute(async (req, res) => {
  const input = z.object({
    incidentId: z.string().optional(),
    searchMissionId: z.string().optional(),
    latitude: z.number(),
    longitude: z.number(),
    elapsedMinutes: z.number().min(0).max(240)
  }).parse(req.body);
  const snapshot = await getCurrentEnvironmentalSnapshot(prisma);
  const prediction = await createDriftPrediction(prisma, { ...input, snapshot });
  io.emit("drift.created", prediction);
  res.json(prediction);
}));
app.get("/api/playback", asyncRoute(async (_req, res) => {
  const recordings = await prisma.recording.findMany({
    orderBy: { startedAt: "desc" },
    include: { drone: true, events: { orderBy: { offsetSec: "asc" } }, changes: true }
  });
  res.json(recordings);
}));
app.get("/api/evidence", asyncRoute(async (_req, res) => {
  const evidence = await prisma.evidence.findMany({
    orderBy: { createdAt: "desc" },
    include: { incident: { include: { drone: true, events: { orderBy: { createdAt: "asc" } }, assignments: { include: { rescuer: true } } } }, assets: true }
  });
  res.json(evidence);
}));
app.post("/api/evidence/:incidentId", asyncRoute(async (req, res) => {
  const evidence = await createEvidencePackage(prisma, routeParam(req.params.incidentId));
  io.emit("evidence.created", evidence);
  res.json(evidence);
}));
app.post("/api/dispatcher/analyze-text", asyncRoute(async (req, res) => {
  const input = z.object({ text: z.string().min(4) }).parse(req.body);
  const lower = input.text.toLowerCase();
  const hasBackpack = lower.includes("\u0440\u044E\u043A\u0437\u0430\u043A");
  const hasRed = lower.includes("\u043A\u0440\u0430\u0441\u043D");
  const timeMatch = input.text.match(/(\d{1,2}[:.]\d{2})/);
  res.json({
    source: "Text analysis",
    type: lower.includes("\u043F\u0440\u043E\u043F\u0430\u043B") ? "Missing person" : "Operator report",
    approximateTime: timeMatch?.[1]?.replace(".", ":") ?? "\u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D\u043E",
    location: lower.includes("\u0441\u043A\u0430\u043B") ? "\u0421\u043A\u0430\u043B\u044C\u043D\u0430\u044F \u0437\u043E\u043D\u0430 \u0410\u043A\u0442\u0430\u0443" : "\u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u0432\u044B\u0431\u043E\u0440\u0430 \u043E\u043F\u0435\u0440\u0430\u0442\u043E\u0440\u043E\u043C",
    object: "Person",
    distinctiveItems: [hasRed ? "\u041A\u0440\u0430\u0441\u043D\u0430\u044F \u043E\u0434\u0435\u0436\u0434\u0430" : null, hasBackpack ? "\u0420\u044E\u043A\u0437\u0430\u043A" : null].filter(Boolean),
    suggestedResponse: "SEARCH & RESCUE",
    requiresConfirmation: true
  });
}));
app.get("/api/drones", asyncRoute(async (_req, res) => {
  const drones = await prisma.drone.findMany({
    orderBy: { name: "asc" },
    include: { telemetry: { orderBy: { createdAt: "desc" }, take: 24 }, incidents: { orderBy: { createdAt: "desc" }, take: 5 } }
  });
  res.json(drones);
}));
app.post("/api/patrols", asyncRoute(async (req, res) => {
  const input = z.object({
    droneId: z.string(),
    area: z.string().min(2),
    missionType: z.string().min(2),
    modules: z.array(z.string()).min(1)
  }).parse(req.body);
  const count = await prisma.patrol.count();
  const patrol = await prisma.patrol.create({
    data: {
      publicId: `PT-2409-${String(count + 2).padStart(2, "0")}`,
      droneId: input.droneId,
      area: input.area,
      missionType: input.missionType,
      modules: input.modules,
      status: PatrolStatus.ACTIVE,
      route: [[43.676, 51.125], [43.646, 51.149], [43.622, 51.157]],
      startedAt: /* @__PURE__ */ new Date()
    }
  });
  io.emit("patrol:created", patrol);
  res.json(patrol);
}));
app.get("/api/analytics", asyncRoute(async (_req, res) => {
  const [incidents, detections, patrols] = await Promise.all([
    prisma.incident.findMany(),
    prisma.detection.findMany(),
    prisma.patrol.findMany()
  ]);
  const byType = Object.values(IncidentType2).map((type) => ({ type, count: incidents.filter((incident) => incident.type === type).length }));
  const byStatus = Object.values(IncidentStatus).map((status) => ({ status, count: incidents.filter((incident) => incident.status === status).length }));
  const byDay = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.now() - (6 - index) * 24 * 60 * 60 * 1e3);
    const key = date.toISOString().slice(0, 10);
    return { day: key.slice(5), count: incidents.filter((incident) => incident.createdAt.toISOString().slice(0, 10) === key).length };
  });
  const confirmed = detections.filter((detection) => detection.feedback === "confirmed").length;
  const falseAlarms = detections.filter((detection) => detection.feedback === "false_alarm").length;
  res.json({
    totals: {
      patrols: patrols.length,
      detections: detections.length,
      confirmedIncidents: incidents.filter((incident) => incident.status !== "FALSE_ALARM").length,
      resolvedIncidents: incidents.filter((incident) => incident.status === "RESOLVED").length,
      averageResponseMin: 7
    },
    byType,
    byStatus,
    byDay,
    confidence: detections.map((detection) => ({ confidence: detection.confidence })),
    feedback: { total: detections.length, confirmed, falseAlarms }
  });
}));
app.post("/api/search-missions", asyncRoute(async (req, res) => {
  const input = z.object({
    centerLatitude: z.number(),
    centerLongitude: z.number(),
    radius: z.number().min(100).max(5e3),
    approximateTime: z.string(),
    description: z.string().min(3),
    distinctiveItems: z.array(z.string()).default([]),
    visualReferenceUrl: z.string().optional()
  }).parse(req.body);
  const count = await prisma.searchMission.count();
  const mission = await prisma.searchMission.create({
    data: {
      publicId: `SR-${1025 + count}`,
      status: "ACTIVE",
      centerLatitude: input.centerLatitude,
      centerLongitude: input.centerLongitude,
      radius: input.radius,
      approximateTime: new Date(input.approximateTime),
      description: input.description,
      distinctiveItems: input.distinctiveItems,
      startedAt: /* @__PURE__ */ new Date()
    }
  });
  await prisma.targetSighting.createMany({
    data: [
      {
        searchMissionId: mission.id,
        sourceType: "Operator report",
        latitude: input.centerLatitude,
        longitude: input.centerLongitude,
        timestamp: new Date(input.approximateTime),
        confidence: 68,
        metadata: { label: "LAST KNOWN POSITION", visualReferenceUrl: input.visualReferenceUrl ?? null }
      }
    ]
  });
  io.emit("search:created", mission);
  res.json(mission);
}));
app.post("/api/search-missions/:id/candidates", asyncRoute(async (req, res) => {
  const input = z.object({ status: z.nativeEnum(CandidateStatus) }).parse(req.body);
  const candidate = await prisma.searchCandidate.update({ where: { id: routeParam(req.params.id) }, data: { status: input.status } });
  res.json(candidate);
}));
app.get("/api/offline/events", asyncRoute(async (_req, res) => {
  const events = await prisma.offlineSyncEvent.findMany({ orderBy: { createdAt: "desc" }, take: 30 });
  res.json(events);
}));
app.post("/api/offline/events", asyncRoute(async (req, res) => {
  const input = z.object({
    idempotencyKey: z.string().min(4),
    type: z.string().min(2),
    payload: z.record(z.string(), z.unknown()).default({})
  }).parse(req.body);
  const payload = input.payload;
  const event = await prisma.offlineSyncEvent.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    update: { payload },
    create: { idempotencyKey: input.idempotencyKey, type: input.type, payload }
  });
  io.emit("offline.started", event);
  res.json(event);
}));
app.post("/api/offline/sync", asyncRoute(async (_req, res) => {
  await prisma.offlineSyncEvent.updateMany({ where: { status: "QUEUED" }, data: { status: "SYNCING" } });
  io.emit("offline.syncing");
  const result = await prisma.offlineSyncEvent.updateMany({ where: { status: "SYNCING" }, data: { status: "SYNCED", syncedAt: /* @__PURE__ */ new Date() } });
  io.emit("offline.synced", result);
  res.json({ ok: true, synced: result.count });
}));
app.get("/api/rescue/current", asyncRoute(async (_req, res) => {
  const assignment = await prisma.rescueAssignment.findFirst({
    where: { status: { in: [AssignmentStatus.SENT, AssignmentStatus.ACCEPTED, AssignmentStatus.ARRIVED] } },
    orderBy: { createdAt: "desc" },
    include: { incident: true, rescuer: true }
  });
  res.json(assignment);
}));
app.post("/api/rescue/:assignmentId/action", asyncRoute(async (req, res) => {
  const input = z.object({ action: z.enum(["ACCEPT", "ARRIVED", "RESCUED"]) }).parse(req.body);
  res.json(await applyRescueAction(routeParam(req.params.assignmentId), input.action));
}));
io.on("connection", (socket) => {
  socket.emit("system:ready", { ok: true });
});
app.use((error, _req, res, _next) => {
  const message = error instanceof Error ? error.message : "\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F \u043E\u0448\u0438\u0431\u043A\u0430";
  res.status(500).json({ message });
});
if (process.env.VERCEL !== "1") {
  httpServer.listen(env.port, () => {
    console.log(`Boltzzmann API listening on http://localhost:${env.port}`);
  });
}
var index_default = app;
export {
  app,
  index_default as default,
  httpServer,
  io
};
