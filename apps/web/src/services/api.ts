import type { AdminSnapshot, Drone, DroneConnection, Evidence, Incident, IncidentStatus, IncidentType, Overview, Recording, Rescuer, RescueAssignment, Severity, User, UserRole } from "../types/domain";

const baseUrl = import.meta.env.VITE_API_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: "Ошибка запроса" }));
    throw new Error(body.message ?? "Ошибка запроса");
  }
  return response.json() as Promise<T>;
}

export const api = {
  login: (body: { email: string; password: string }) => request<{ user: User }>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  overview: () => request<Overview>("/api/overview"),
  activeConnection: () => request<DroneConnection | null>("/api/connections/active"),
  connectSession: (body: { model: string; method: "QR" | "DJI_APP" | "SERIAL"; serialNumber?: string }) =>
    request<DroneConnection>("/api/connections/connect", { method: "POST", body: JSON.stringify(body) }),
  disconnectSession: () => request("/api/connections/disconnect", { method: "POST" }),
  playback: () => request<Recording[]>("/api/playback"),
  evidence: () => request<Evidence[]>("/api/evidence"),
  createEvidence: (incidentId: string) => request<Evidence>(`/api/evidence/${incidentId}`, { method: "POST" }),
  analyzeText: (text: string) => request<unknown>("/api/dispatcher/analyze-text", { method: "POST", body: JSON.stringify({ text }) }),
  analytics: () => request<unknown>("/api/analytics"),
  drones: () => request<unknown>("/api/drones"),
  connectDrone: (body: { serialNumber: string; name?: string; station?: string }) =>
    request("/api/drones/connect", { method: "POST", body: JSON.stringify(body) }),
  createIncident: (body: {
    type: IncidentType;
    status?: IncidentStatus;
    severity?: Severity;
    confidence: number;
    latitude: number;
    longitude: number;
    droneId?: string;
    message?: string;
  }) => request<Incident>("/api/incidents", { method: "POST", body: JSON.stringify(body) }),
  dispatch: (incidentId: string) => request(`/api/incidents/${incidentId}/dispatch`, { method: "POST" }),
  incidentStatus: (incidentId: string, status: string, message?: string) =>
    request(`/api/incidents/${incidentId}/status`, { method: "POST", body: JSON.stringify({ status, message }) }),
  createMission: (body: {
    centerLatitude: number;
    centerLongitude: number;
    radius: number;
    approximateTime: string;
    description: string;
    distinctiveItems: string[];
    visualReferenceUrl?: string;
  }) => request("/api/search-missions", { method: "POST", body: JSON.stringify(body) }),
  updateCandidate: (candidateId: string, status: "NEW" | "POSSIBLE_TARGET" | "REJECTED") =>
    request(`/api/search-missions/${candidateId}/candidates`, { method: "POST", body: JSON.stringify({ status }) }),
  createDrift: (body: { incidentId?: string; searchMissionId?: string; latitude: number; longitude: number; elapsedMinutes: number }) =>
    request("/api/drift", { method: "POST", body: JSON.stringify(body) }),
  offlineEvents: () => request<unknown[]>("/api/offline/events"),
  queueOfflineEvent: (body: { idempotencyKey: string; type: string; payload: Record<string, unknown> }) =>
    request("/api/offline/events", { method: "POST", body: JSON.stringify(body) }),
  syncOffline: () => request("/api/offline/sync", { method: "POST" }),
  createPatrol: (body: { droneId: string; area: string; missionType: string; modules: string[] }) =>
    request("/api/patrols", { method: "POST", body: JSON.stringify(body) }),
  currentRescue: () => request<RescueAssignment | null>("/api/rescue/current"),
  rescueAction: (assignmentId: string, action: "ACCEPT" | "ARRIVED" | "RESCUED") =>
    request<RescueAssignment>(`/api/rescue/${assignmentId}/action`, { method: "POST", body: JSON.stringify({ action }) }),
  adminSnapshot: () => request<AdminSnapshot>("/api/admin/snapshot"),
  createUser: (body: { name: string; email: string; role: UserRole; password: string }) =>
    request<User>("/api/admin/users", { method: "POST", body: JSON.stringify(body) }),
  updateUser: (id: string, body: { name: string; email: string; role: UserRole; password?: string }) =>
    request<User>(`/api/admin/users/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteUser: (id: string) => request(`/api/admin/users/${id}`, { method: "DELETE" }),
  createAdminDrone: (body: {
    serialNumber: string;
    name: string;
    model: string;
    status: Drone["status"];
    battery: number;
    latitude: number;
    longitude: number;
    altitude: number;
    station?: string;
    mission?: string;
  }) => request<Drone>("/api/admin/drones", { method: "POST", body: JSON.stringify(body) }),
  updateAdminDrone: (id: string, body: {
    serialNumber: string;
    name: string;
    model: string;
    status: Drone["status"];
    battery: number;
    latitude: number;
    longitude: number;
    altitude: number;
    station?: string;
    mission?: string;
  }) => request<Drone>(`/api/admin/drones/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteDrone: (id: string) => request(`/api/admin/drones/${id}`, { method: "DELETE" }),
  createRescuer: (body: { name: string; callSign: string; status: Rescuer["status"]; latitude: number; longitude: number }) =>
    request<Rescuer>("/api/admin/rescuers", { method: "POST", body: JSON.stringify(body) }),
  updateRescuer: (id: string, body: { name: string; callSign: string; status: Rescuer["status"]; latitude: number; longitude: number }) =>
    request<Rescuer>(`/api/admin/rescuers/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteRescuer: (id: string) => request(`/api/admin/rescuers/${id}`, { method: "DELETE" }),
  createRecording: (body: { droneId: string; mission: string; videoUrl: string; startedAt: string; endedAt: string; metadata?: Record<string, unknown> }) =>
    request<Recording>("/api/admin/recordings", { method: "POST", body: JSON.stringify(body) }),
  deleteRecording: (id: string) => request(`/api/admin/recordings/${id}`, { method: "DELETE" })
};
