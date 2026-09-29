import type { EnvironmentalSnapshot, PrismaClient } from "@prisma/client";

function projectPoint(latitude: number, longitude: number, bearingDeg: number, meters: number) {
  const rad = (bearingDeg * Math.PI) / 180;
  const dLat = (Math.cos(rad) * meters) / 111_320;
  const dLon = (Math.sin(rad) * meters) / (111_320 * Math.cos((latitude * Math.PI) / 180));
  return { latitude: +(latitude + dLat).toFixed(6), longitude: +(longitude + dLon).toFixed(6) };
}

export function calculateDriftAreas(input: {
  latitude: number;
  longitude: number;
  elapsedMinutes: number;
  snapshot: EnvironmentalSnapshot;
}) {
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

export async function createDriftPrediction(
  prisma: PrismaClient,
  input: {
    incidentId?: string;
    searchMissionId?: string;
    latitude: number;
    longitude: number;
    elapsedMinutes: number;
    snapshot: EnvironmentalSnapshot;
  }
) {
  const areas = calculateDriftAreas(input);
  return prisma.driftPrediction.create({
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
