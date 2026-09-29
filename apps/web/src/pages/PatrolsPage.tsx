import { Pause, Play, Route, Square } from "lucide-react";
import { useState } from "react";
import { api } from "../services/api";
import { useOverview } from "../hooks/useOverview";
import { StatusBadge } from "../components/StatusBadge";

const modules = ["Potential drowning", "Safe zone", "Restricted zone", "Fisherman safety", "Children risk"];

export function PatrolsPage() {
  const { data, refresh } = useOverview();
  const [selectedModules, setSelectedModules] = useState(["Potential drowning", "Safe zone"]);
  const firstDrone = data?.drones[0];

  async function createPatrol() {
    if (!firstDrone) return;
    await api.createPatrol({
      droneId: firstDrone.id,
      area: "Набережная Актау - северный сектор",
      missionType: "Береговой мониторинг",
      modules: selectedModules
    });
    await refresh();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
      <section className="card p-4">
        <h1 className="text-2xl font-extrabold">Новый патруль</h1>
        <div className="mt-4 space-y-3 text-sm">
          <label className="block font-bold">Drone</label>
          <div className="rounded-2xl border border-line bg-white p-3">{firstDrone?.name ?? "Нет дрона"} · {firstDrone?.model}</div>
          <label className="block font-bold">Area</label>
          <div className="rounded-2xl border border-line bg-white p-3">Набережная Актау - северный сектор</div>
          <label className="block font-bold">Monitoring modules</label>
          <div className="space-y-2">
            {modules.map((module) => (
              <label key={module} className="flex items-center gap-2 rounded-2xl border border-line p-3">
                <input type="checkbox" checked={selectedModules.includes(module)} onChange={() => setSelectedModules((items) => items.includes(module) ? items.filter((item) => item !== module) : [...items, module])} />
                {module}
              </label>
            ))}
          </div>
        </div>
        <button className="btn btn-primary mt-5 w-full" onClick={createPatrol}><Play size={16} /> Создать патруль в БД</button>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {(data?.patrols ?? []).map((patrol) => (
          <article key={patrol.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="mono text-sm text-muted">{patrol.publicId}</div>
                <h2 className="text-xl font-extrabold">{patrol.area}</h2>
              </div>
              <StatusBadge value={patrol.status} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
              <div className="rounded-2xl bg-[#f1f3f5] p-3"><b>{patrol.progress}%</b><br />маршрут</div>
              <div className="rounded-2xl bg-[#f1f3f5] p-3"><b>{patrol.detections.length}</b><br />детекции</div>
              <div className="rounded-2xl bg-[#f1f3f5] p-3"><b>{patrol.incidents.length}</b><br />инциденты</div>
            </div>
            <div className="mt-4 flex gap-2">
              <button className="btn"><Play size={15} /> Start</button>
              <button className="btn"><Pause size={15} /> Pause</button>
              <button className="btn"><Square size={15} /> Complete</button>
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm text-muted"><Route size={16} /> {patrol.drone.name} · {patrol.missionType}</div>
          </article>
        ))}
      </section>
    </div>
  );
}
