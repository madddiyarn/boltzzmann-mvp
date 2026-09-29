import { BatteryCharging, MapPin, Plane, RadioTower } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { StatusBadge } from "../components/StatusBadge";
import { useOverview } from "../hooks/useOverview";

export function DronesPage() {
  const { data, loading } = useOverview();
  if (loading || !data) return <div className="card p-6 text-muted">Загрузка флота...</div>;

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
      <section className="grid gap-4 md:grid-cols-2">
        {data.drones.map((drone) => (
          <article key={drone.id} className="card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="mono text-sm text-muted">{drone.serialNumber}</div>
                <h2 className="text-xl font-extrabold">{drone.name}</h2>
              </div>
              <StatusBadge value={drone.status} />
            </div>
            <p className="mt-2 text-sm text-muted">{drone.model}</p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
              <div className="rounded-2xl bg-[#f1f3f5] p-3"><BatteryCharging className="mx-auto mb-1" size={17} /><b>{drone.battery}%</b></div>
              <div className="rounded-2xl bg-[#f1f3f5] p-3"><Plane className="mx-auto mb-1" size={17} /><b>{drone.altitude} м</b></div>
              <div className="rounded-2xl bg-[#f1f3f5] p-3"><RadioTower className="mx-auto mb-1" size={17} /><b>{drone.cameraStatus}</b></div>
            </div>
            <p className="mono mt-4 text-xs text-muted">{drone.latitude.toFixed(5)}, {drone.longitude.toFixed(5)}</p>
            <p className="mt-2 text-sm font-semibold">{drone.mission}</p>
          </article>
        ))}
      </section>
      <aside className="card p-4">
        <h1 className="text-2xl font-extrabold">Телеметрия Boltzzmann-01</h1>
        <p className="mt-2 text-sm text-muted">Телеметрия читается из PostgreSQL и обновляется вместе с флотом.</p>
        <div className="mt-5 h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.telemetry.slice().reverse()}>
              <XAxis dataKey="createdAt" hide />
              <YAxis />
              <Tooltip labelFormatter={(value) => new Date(String(value)).toLocaleTimeString("ru-RU")} />
              <Area type="monotone" dataKey="battery" stroke="#0f87a8" fill="#e7f6fa" strokeWidth={3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 space-y-3">
          {data.drones.map((drone) => (
            <div key={drone.id} className="flex items-center justify-between rounded-2xl border border-line p-3">
              <div className="flex items-center gap-2"><MapPin size={16} className="text-[#0f87a8]" /><b>{drone.name}</b></div>
              <span className="mono text-xs text-muted">{new Date(drone.lastSeenAt).toLocaleTimeString("ru-RU")}</span>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}
