import { AlertTriangle, BatteryCharging, CheckCircle2, Gauge, Radio, RefreshCw, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useOverview } from "../hooks/useOverview";
import { incidentStatusLabel, incidentTypeLabel } from "../i18n/ru";
import { api } from "../services/api";
import type { Recording } from "../types/domain";

export function LivePage() {
  const { data, loading, refresh } = useOverview();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [highlightVision, setHighlightVision] = useState(false);

  useEffect(() => {
    api.playback().then(setRecordings).catch(() => setRecordings([]));
  }, []);

  const activeDrone = data?.activeConnection?.drone ?? data?.drones.find((drone) => drone.status === "ONLINE") ?? data?.drones[0];
  const latestRecording = useMemo(() => recordings[0], [recordings]);
  const latestDetection = data?.detections[0];
  const activeIncidents = data?.incidents.filter((incident) => !["RESOLVED", "FALSE_ALARM"].includes(incident.status)) ?? [];
  const confidence = latestDetection?.confidence ?? activeIncidents[0]?.confidence ?? 0;

  if (loading || !data) return <div className="ops-panel m-4 p-6 text-muted">Загрузка Live Operations из БД...</div>;

  return (
    <div className="min-h-[calc(100vh-58px)] bg-[#F2F0E9] p-3">
      <section className="ops-panel mb-3 flex flex-wrap items-center justify-between gap-4 p-3">
        <div>
          <p className="ops-label">DRN / {activeDrone?.name?.replace("Boltzzmann-", "B-") ?? "NO DRONE"} · COASTAL GROUND CONTROL</p>
          <h1 className="text-2xl font-extrabold">Live Operations</h1>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="btn px-3 py-1"><Radio size={16} /> {data.activeConnection ? "LINK / ACTIVE" : "LINK / WAIT"}</span>
          <span className="btn px-3 py-1"><BatteryCharging size={16} /> BAT {activeDrone?.battery ?? 0}%</span>
          <span className="btn px-3 py-1"><Gauge size={16} /> ALT {activeDrone?.altitude ?? 0}M</span>
          <span className="btn px-3 py-1"><CheckCircle2 size={16} /> GPS {activeDrone?.gpsStatus ?? "N/A"}</span>
          <button className="btn px-3 py-1" onClick={() => refresh()}><RefreshCw size={16} /> Обновить БД</button>
        </div>
      </section>

      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.75fr)_390px]">
        <div className="ops-panel overflow-hidden p-0">
          <div className="relative min-h-[650px] overflow-hidden border border-line bg-[#dfe6df]">
            {latestRecording?.videoUrl ? (
              <video
                key={latestRecording.id}
                className="absolute inset-0 h-full w-full object-cover"
                src={latestRecording.videoUrl}
                controls
                muted
                playsInline
              />
            ) : (
              <img
                src={highlightVision ? "/media/coast-highlight.png" : "/media/coast-original.png"}
                alt="Coastal camera feed"
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(23,32,30,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(23,32,30,0.08)_1px,transparent_1px)] bg-[length:54px_54px]" />
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#17201E]/30">
              <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[#17201E]/30" />
              <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-[#17201E]/30" />
            </div>
            {latestDetection && (
              <div className="pointer-events-none absolute left-[42%] top-[31%] h-[26%] w-[18%] border-2 border-[#FF5A36] bg-[#FF5A36]/6">
                <div className="absolute -top-8 left-0 bg-[#FF5A36] px-2 py-1 font-mono text-xs font-bold text-white">
                  DET / {latestDetection.type} · {latestDetection.confidence}%
                </div>
              </div>
            )}
            <div className="absolute left-4 top-4 border border-line bg-[#FAF9F5]/88 px-3 py-2 font-mono text-xs font-bold text-[#17201E]">
              SRC / {latestRecording ? latestRecording.publicId : "DB CAMERA FEED"} · {highlightVision ? "VISION" : "RAW"}
            </div>
            <div className="absolute right-4 top-4 border border-line bg-[#FAF9F5]/88 px-3 py-2 font-mono text-xs font-bold text-[#17201E]">
              {new Date().toLocaleTimeString("ru-RU")} / SEC AKT-07
            </div>
            {activeIncidents.length > 0 && (
              <div className="absolute inset-x-6 top-20 cut-corner border border-[#D92D20] bg-[#FAF9F5]/95 p-5 shadow-soft">
                <div className="flex items-center gap-3 text-[#D92D20]">
                  <ShieldAlert size={28} />
                  <div>
                    <div className="ops-label text-[#D92D20]">ACTIVE INCIDENT FROM DATABASE</div>
                    <div className="text-2xl font-extrabold">Активных инцидентов: {activeIncidents.length}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="telemetry-strip">
            <Telemetry label="ALT" value={`${activeDrone?.altitude ?? 0}M`} detail="DB TELEMETRY" />
            <Telemetry label="SPD" value={`${data.telemetry[0]?.speed ?? 0}M/S`} detail="GROUND" />
            <Telemetry label="HDG" value={`${data.telemetry[0]?.heading ?? 0}°`} detail="TRUE" />
            <Telemetry label="BAT" value={`${activeDrone?.battery ?? 0}%`} detail={activeDrone?.name?.replace("Boltzzmann-", "B-") ?? "N/A"} />
            <Telemetry label="LINK" value={data.activeConnection ? "ACTIVE" : "WAIT"} detail={data.activeConnection?.method ?? "NO SESSION"} />
            <Telemetry label="GPS" value={activeDrone?.gpsStatus ?? "N/A"} detail="DATABASE" />
          </div>
        </div>

        <aside className="space-y-4">
          <div className="ops-panel p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="ops-label">Boltzzmann VISION</div>
                <h2 className="font-extrabold">Detections From DB</h2>
              </div>
              <span className="ops-label">POSTGRESQL</span>
            </div>
            <div className="mt-5">
              <div className="flex justify-between text-sm font-bold"><span>Latest detection</span><span>{confidence}%</span></div>
              <div className="mt-2 h-2 bg-[#E8E4D8]"><div className="h-2 bg-[#D92D20]" style={{ width: `${confidence}%` }} /></div>
              <div className="mt-4 flex justify-between text-sm font-bold text-muted"><span>{latestDetection?.type ?? "Нет детекций"}</span><span>{latestDetection ? new Date(latestDetection.createdAt).toLocaleTimeString("ru-RU") : "—"}</span></div>
            </div>
            <div className="mt-5 space-y-2">
              {data.detections.slice(0, 5).map((detection) => (
                <div key={detection.id} className="border border-line bg-[#F2F0E9] p-2">
                  <div className="mono text-xs text-muted">{new Date(detection.createdAt).toLocaleString("ru-RU")}</div>
                  <div className="font-bold">{detection.type} · {detection.confidence}%</div>
                </div>
              ))}
            </div>
          </div>

          <div className="ops-panel p-4">
            <div className="ops-label">INCIDENT WATCH</div>
            <h2 className="font-extrabold">Активные записи</h2>
            <div className="mt-4 space-y-2">
              {activeIncidents.length === 0 && <p className="text-sm text-muted">В базе нет активных инцидентов.</p>}
              {activeIncidents.map((incident) => (
                <div key={incident.id} className="border border-line bg-[#F2F0E9] p-3">
                  <div className="flex items-center gap-2 text-[#D92D20]"><AlertTriangle size={16} /><b>{incident.publicId}</b></div>
                  <p className="mt-1 text-sm font-bold">{incidentTypeLabel[incident.type]}</p>
                  <p className="mono mt-1 text-xs text-muted">{incidentStatusLabel[incident.status]} · {incident.latitude.toFixed(5)}, {incident.longitude.toFixed(5)}</p>
                </div>
              ))}
            </div>
          </div>

          <button className={`btn w-full ${highlightVision ? "btn-primary" : ""}`} onClick={() => setHighlightVision((value) => !value)}>
            Highlight people and sea <span className="mono ml-auto text-xs">{highlightVision ? "ON" : "OFF"}</span>
          </button>
        </aside>
      </section>
    </div>
  );
}

function Telemetry({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="telemetry-cell">
      <div className="ops-label">{label}</div>
      <div className="telemetry-value">{value}</div>
      <div className="mono text-[10px] text-muted">{detail}</div>
    </div>
  );
}
