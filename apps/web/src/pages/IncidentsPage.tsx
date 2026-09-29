import { CheckCircle2, FileText, LifeBuoy, Plus, ShieldAlert, XCircle } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "../components/StatusBadge";
import { incidentStatusLabel, incidentTypeLabel, severityLabel } from "../i18n/ru";
import { api } from "../services/api";
import { useOverview } from "../hooks/useOverview";
import type { Incident, IncidentType, Severity } from "../types/domain";

const incidentTypes: IncidentType[] = ["POTENTIAL_DROWNING", "SAFE_ZONE_VIOLATION", "RESTRICTED_ZONE", "PERSON_OVERBOARD", "CHILD_RISK", "FISHERMAN_SAFETY", "SEARCH_TARGET"];
const severities: Severity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export function IncidentsPage() {
  const { data, loading, refresh } = useOverview();
  const [filter, setFilter] = useState("ACTIVE");
  const [selected, setSelected] = useState<Incident | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    type: "POTENTIAL_DROWNING" as IncidentType,
    severity: "HIGH" as Severity,
    confidence: 80,
    latitude: 43.646,
    longitude: 51.149,
    droneId: "",
    message: "Инцидент создан из панели оператора"
  });

  if (loading || !data) return <div className="card p-6 text-muted">Загрузка инцидентов...</div>;
  const incidents = data.incidents.filter((incident) => {
    if (filter === "ALL") return true;
    if (filter === "ACTIVE") return !["RESOLVED", "FALSE_ALARM"].includes(incident.status);
    if (filter === "CRITICAL") return incident.severity === "CRITICAL";
    return incident.status === "RESOLVED";
  });

  async function action(status: string, message: string) {
    if (!selected) return;
    await api.incidentStatus(selected.id, status, message);
    await refresh();
    setSelected(null);
  }

  async function dispatch() {
    if (!selected) return;
    await api.dispatch(selected.id);
    await refresh();
  }

  async function createEvidence() {
    if (!selected) return;
    setBusy(true);
    try {
      await api.createEvidence(selected.id);
      setMessage("Evidence package сформирован и сохранён в PostgreSQL.");
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function createIncident() {
    setBusy(true);
    setMessage(null);
    try {
      await api.createIncident({
        ...form,
        droneId: form.droneId || undefined
      });
      setMessage("Инцидент создан и сохранён в PostgreSQL.");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось создать инцидент");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="card p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold">Управление инцидентами</h1>
          <div className="flex gap-2">
            {["ACTIVE", "RESOLVED", "CRITICAL", "ALL"].map((item) => (
              <button key={item} className={`btn px-3 py-1.5 text-xs ${filter === item ? "btn-primary" : ""}`} onClick={() => setFilter(item)}>{item}</button>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-xs uppercase text-muted">
              <tr>
                <th className="p-3">ID</th>
                <th className="p-3">Тип</th>
                <th className="p-3">Статус</th>
                <th className="p-3">Drone</th>
                <th className="p-3">Координаты</th>
                <th className="p-3">AI</th>
              </tr>
            </thead>
            <tbody>
              {incidents.map((incident) => (
                <tr key={incident.id} onClick={() => setSelected(incident)} className="cursor-pointer border-t border-line hover:bg-[#f7f8fa]">
                  <td className="mono p-3 font-bold">{incident.publicId}</td>
                  <td className="p-3">{incidentTypeLabel[incident.type]} <span className="text-muted">· {severityLabel[incident.severity]}</span></td>
                  <td className="p-3"><StatusBadge value={incidentStatusLabel[incident.status]} /></td>
                  <td className="p-3">{incident.drone?.name ?? "—"}</td>
                  <td className="mono p-3 text-xs">{incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}</td>
                  <td className="p-3 font-bold">{incident.confidence}%</td>
                </tr>
              ))}
              {incidents.length === 0 && (
                <tr>
                  <td colSpan={6} className="border-t border-line p-8">
                    <div className="mx-auto max-w-md text-center">
                      <ShieldAlert className="mx-auto mb-3 text-muted" />
                      <h2 className="text-xl font-extrabold">Нет инцидентов по выбранному фильтру</h2>
                      <p className="mt-2 text-sm text-muted">Инциденты появятся здесь после создания через API, контроллера или форму справа.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {message && <p className="mt-4 rounded-2xl bg-[#eaf8f0] p-3 text-sm font-semibold text-[#067647]">{message}</p>}
      </section>

      <aside className="card p-4">
        {selected ? (
          <>
            <div className="mono text-sm text-muted">{selected.publicId}</div>
            <h2 className="text-2xl font-extrabold">{incidentTypeLabel[selected.type]}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge value={incidentStatusLabel[selected.status]} />
              <StatusBadge value={`${selected.confidence}%`} />
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <p><b>Drone:</b> {selected.drone?.name}</p>
              <p className="mono"><b>GPS:</b> {selected.latitude.toFixed(5)}, {selected.longitude.toFixed(5)}</p>
              <p><b>Время:</b> {new Date(selected.detectedAt).toLocaleString("ru-RU")}</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button className="btn" onClick={() => action("CONFIRMED", "Оператор подтвердил инцидент")}><CheckCircle2 size={16} /> Подтвердить</button>
              <button className="btn btn-primary" onClick={dispatch}><LifeBuoy size={16} /> Dispatch</button>
              <button className="btn" disabled={busy} onClick={createEvidence}><FileText size={16} /> Evidence</button>
              <button className="btn" onClick={() => action("RESOLVED", "Инцидент закрыт")}><CheckCircle2 size={16} /> Закрыть</button>
              <button className="btn btn-danger col-span-2" onClick={() => action("FALSE_ALARM", "Оператор отметил ложную тревогу")}><XCircle size={16} /> Ложная тревога</button>
            </div>
            <h3 className="mt-6 font-extrabold">Timeline</h3>
            <div className="mt-3 space-y-3">
              {(selected.events ?? []).map((event) => (
                <div key={event.id} className="border-l-2 border-[#0f87a8] pl-3">
                  <div className="mono text-xs text-muted">{new Date(event.createdAt).toLocaleTimeString("ru-RU")}</div>
                  <div className="text-sm font-semibold">{event.message}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div>
            <div className="mono text-sm text-muted">DB / CREATE INCIDENT</div>
            <h2 className="text-2xl font-extrabold">Новый инцидент</h2>
            <div className="mt-4 space-y-3 text-sm">
              <label className="block font-bold">
                Тип
                <select className="field mt-1 w-full" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as IncidentType })}>
                  {incidentTypes.map((type) => <option key={type} value={type}>{incidentTypeLabel[type]}</option>)}
                </select>
              </label>
              <label className="block font-bold">
                Критичность
                <select className="field mt-1 w-full" value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value as Severity })}>
                  {severities.map((severity) => <option key={severity} value={severity}>{severityLabel[severity]}</option>)}
                </select>
              </label>
              <label className="block font-bold">
                Уверенность, %
                <input className="field mt-1 w-full" type="number" min={0} max={100} value={form.confidence} onChange={(event) => setForm({ ...form, confidence: Number(event.target.value) })} />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block font-bold">
                  Latitude
                  <input className="field mt-1 w-full" type="number" value={form.latitude} onChange={(event) => setForm({ ...form, latitude: Number(event.target.value) })} />
                </label>
                <label className="block font-bold">
                  Longitude
                  <input className="field mt-1 w-full" type="number" value={form.longitude} onChange={(event) => setForm({ ...form, longitude: Number(event.target.value) })} />
                </label>
              </div>
              <label className="block font-bold">
                Дрон
                <select className="field mt-1 w-full" value={form.droneId} onChange={(event) => setForm({ ...form, droneId: event.target.value })}>
                  <option value="">Без привязки</option>
                  {data.drones.map((drone) => <option key={drone.id} value={drone.id}>{drone.name}</option>)}
                </select>
              </label>
              <label className="block font-bold">
                Сообщение
                <textarea className="field mt-1 min-h-24 w-full" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} />
              </label>
            </div>
            <button className="btn btn-primary mt-4 w-full" disabled={busy} onClick={createIncident}><Plus size={16} /> Создать в БД</button>
            <p className="mt-4 text-sm text-muted">Выберите строку слева, чтобы открыть детали существующего инцидента.</p>
          </div>
        )}
      </aside>
    </div>
  );
}
