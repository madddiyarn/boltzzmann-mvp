import { Activity, Crosshair, FileText, LifeBuoy, Radio, Route, Waves, Wind } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { StatusBadge } from "../components/StatusBadge";
import { incidentStatusLabel, incidentTypeLabel } from "../i18n/ru";
import { useOverview } from "../hooks/useOverview";
import { api } from "../services/api";
import type { Incident } from "../types/domain";

const filters = [
  ["ALL", "Все"],
  ["POTENTIAL_DROWNING", "Утопление"],
  ["SAFE_ZONE_VIOLATION", "Заплыв за границу"],
  ["CHILD_RISK", "Дети"],
  ["RESTRICTED_ZONE", "Запрещенная зона"],
  ["PERSON_OVERBOARD", "Человек за бортом"],
  ["FISHERMAN_SAFETY", "Рыбаки"],
  ["SEARCH_TARGET", "Поисковые операции"]
];

export function OverviewPage() {
  const { data, loading, error, refresh } = useOverview();
  const [selectedType, setSelectedType] = useState("ALL");
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [highlightVision, setHighlightVision] = useState(false);
  const activeIncidents = useMemo(() => data?.incidents.filter((incident) => !["RESOLVED", "FALSE_ALARM"].includes(incident.status)) ?? [], [data]);

  if (loading) return <div className="ops-panel m-4 p-6 text-muted">Загрузка командного центра...</div>;
  if (error || !data) return <div className="ops-panel m-4 p-6 text-[#D92D20]">{error ?? "Нет данных"}</div>;

  return (
    <div className="boltzzmann-map-shell">
      <div className="relative h-full min-h-[calc(100vh-98px)] overflow-hidden">
        <img
          src={highlightVision ? "/media/coast-highlight.png" : "/media/coast-original.png"}
          alt="Coastal command center visual"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(23,32,30,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(23,32,30,0.08)_1px,transparent_1px)] bg-[length:54px_54px]" />
        <div className="absolute left-4 top-4 z-[430] border border-line bg-[#FAF9F5]/90 px-3 py-2 font-mono text-xs font-bold">
          SRC / coastal-camera-feed · {highlightVision ? "VISION HIGHLIGHT" : "RAW VIEW"}
        </div>
      </div>

      <div className="map-overlay left-3 top-3 w-[min(560px,calc(100vw-104px))] p-3">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <div className="ops-label">MAP / AKT COASTAL GRID</div>
            <h1 className="text-lg font-extrabold">Command Center</h1>
          </div>
          <button className="btn cut-corner px-3 py-1.5 text-xs" onClick={() => refresh()}>
            Обновить БД
          </button>
        </div>
        <button
          className={`btn mb-3 w-full justify-between ${highlightVision ? "btn-primary" : ""}`}
          onClick={() => setHighlightVision((value) => !value)}
        >
          <span>Highlight people and sea</span>
          <span className="mono text-xs">{highlightVision ? "ON" : "OFF"}</span>
        </button>
        <div className="grid grid-cols-4 gap-px bg-line text-xs">
          <OpsMetric label="DRN" value={data.stats.activeDrones} icon={<Radio size={14} />} />
          <OpsMetric label="INC" value={data.stats.activeIncidents} icon={<Crosshair size={14} />} critical={data.stats.activeIncidents > 0} />
          <OpsMetric label="SAR" value={data.stats.availableRescuers} icon={<LifeBuoy size={14} />} />
          <OpsMetric label="PTL" value={data.stats.patrolsToday} icon={<Route size={14} />} />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {filters.map(([value, label]) => (
            <button key={value} className={`btn px-2.5 py-1 text-[11px] ${selectedType === value ? "btn-primary" : ""}`} onClick={() => setSelectedType(value)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <aside className="map-overlay right-3 top-3 w-[min(390px,calc(100vw-104px))] p-3">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="ops-label">INCIDENT WATCH</div>
            <h2 className="font-extrabold">Активные инциденты</h2>
          </div>
          <Activity size={18} className="text-[#087F73]" />
        </div>
        <div className="space-y-2">
          {activeIncidents.length === 0 && (
            <div className="border border-dashed border-line bg-[#F2F0E9]/70 p-3">
              <p className="text-sm font-semibold text-muted">Активных инцидентов нет.</p>
            </div>
          )}
          {activeIncidents.map((incident) => (
            <button key={incident.id} onClick={() => setSelectedIncident(incident)} className="w-full border border-line bg-[#FAF9F5] p-3 text-left hover:border-[#FF5A36]">
              <div className="flex items-center justify-between gap-2">
                <b className="mono">INC / {incident.publicId}</b>
                <StatusBadge value={incidentStatusLabel[incident.status]} />
              </div>
              <p className="mt-2 text-sm font-semibold">{incidentTypeLabel[incident.type]}</p>
              <p className="mono mt-1 text-xs text-muted">SEC / AKT-07 · {incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)} · AI {incident.confidence}%</p>
            </button>
          ))}
        </div>

        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-extrabold">Лента событий</h2>
            <span className="ops-label">EV / LAST 12</span>
          </div>
          <div className="max-h-72 space-y-3 overflow-auto pr-1">
            {data.events.map((event) => (
              <div key={event.id} className="border-l-2 border-[#087F73] pl-3">
                <div className="mono text-[11px] text-muted">EV / {new Date(event.createdAt).toLocaleTimeString("ru-RU")}</div>
                <div className="text-sm font-semibold">{event.message}</div>
                <div className="mono text-[11px] text-muted">{event.incident?.publicId ? `INC / ${event.incident.publicId}` : "SYS / OPS"}</div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <div className="map-overlay bottom-3 left-3 right-3 p-0">
        <div className="telemetry-strip">
          <Telemetry label="DRN" value="B-01" detail="COASTAL PATROL" />
          <Telemetry label="ALT" value={`${data.drones[0]?.altitude ?? 0}M`} detail="DB TELEMETRY" />
          <Telemetry label="BAT" value={`${data.drones[0]?.battery ?? 0}%`} detail="LINK READY" />
          <Telemetry label="SEA" value={`${data.sea.waveHeight.toFixed(1)}M`} detail="MARINE DATA" icon={<Waves size={14} />} />
          <Telemetry label="WIND" value={`${data.sea.windSpeed.toFixed(1)}M/S`} detail={`${data.sea.windDirection} DEG`} icon={<Wind size={14} />} />
          <Telemetry label="OPS" value={data.sea.rescueCondition} detail="RESCUE CONDITIONS" />
        </div>
      </div>

      {selectedIncident && (
        <section className="ops-panel fixed bottom-24 right-5 z-[500] w-[min(440px,calc(100vw-40px))] p-4 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="mono text-sm text-muted">INC / {selectedIncident.publicId}</div>
              <h3 className="text-xl font-extrabold">{incidentTypeLabel[selectedIncident.type]}</h3>
              <p className="mono mt-1 text-sm text-muted">{selectedIncident.latitude.toFixed(5)}, {selectedIncident.longitude.toFixed(5)}</p>
            </div>
            <button className="btn px-3 py-1 text-xs" onClick={() => setSelectedIncident(null)}>Закрыть</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge value={incidentStatusLabel[selectedIncident.status]} />
            <StatusBadge value={`${selectedIncident.confidence}% AI`} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn btn-primary cut-corner" onClick={async () => { await api.dispatch(selectedIncident.id); await refresh(); }}>Направить спасателя</button>
            <button className="btn" onClick={async () => { await api.createEvidence(selectedIncident.id); await refresh(); }}><FileText size={16} /> Сформировать отчёт</button>
            <button className="btn" onClick={async () => {
              await api.createDrift({ incidentId: selectedIncident.id, latitude: selectedIncident.latitude, longitude: selectedIncident.longitude, elapsedMinutes: 10 });
              await refresh();
            }}>
              <Waves size={16} /> Drift
            </button>
            <button className="btn" onClick={async () => { await api.incidentStatus(selectedIncident.id, "RESOLVED", "Инцидент закрыт оператором"); await refresh(); }}>Закрыть</button>
          </div>
        </section>
      )}
    </div>
  );
}

function OpsMetric({ label, value, icon, critical = false }: { label: string; value: string | number; icon: ReactNode; critical?: boolean }) {
  return (
    <div className="bg-[#FAF9F5] p-2">
      <div className="flex items-center justify-between text-muted">
        <span className="ops-label">{label}</span>
        {icon}
      </div>
      <div className={`mono mt-1 text-lg font-extrabold ${critical ? "text-[#D92D20]" : "text-ink"}`}>{value}</div>
    </div>
  );
}

function Telemetry({ label, value, detail, icon }: { label: string; value: string | number; detail: string; icon?: ReactNode }) {
  return (
    <div className="telemetry-cell">
      <div className="flex items-center justify-between">
        <span className="ops-label">{label}</span>
        {icon}
      </div>
      <div className="telemetry-value">{value}</div>
      <div className="mono text-[10px] text-muted">{detail}</div>
    </div>
  );
}
