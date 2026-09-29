import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity, CheckCircle2, Crosshair, Radio, Route } from "lucide-react";
import { api } from "../services/api";
import { StatCard } from "../components/StatCard";
import { incidentStatusLabel, incidentTypeLabel } from "../i18n/ru";

interface Analytics {
  totals: { patrols: number; detections: number; confirmedIncidents: number; resolvedIncidents: number; averageResponseMin: number };
  byType: { type: keyof typeof incidentTypeLabel; count: number }[];
  byStatus: { status: keyof typeof incidentStatusLabel; count: number }[];
  byDay: { day: string; count: number }[];
  confidence: { confidence: number }[];
  feedback: { total: number; confirmed: number; falseAlarms: number };
}

export function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    api.analytics().then((payload) => setData(payload as Analytics)).catch(() => setData(null));
  }, []);

  if (!data) return <div className="card p-6 text-muted">Загрузка аналитики...</div>;
  const confirmShare = data.feedback.total ? Math.round((data.feedback.confirmed / data.feedback.total) * 100) : 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Патрули" value={data.totals.patrols} detail="из базы данных" icon={Route} />
        <StatCard label="Детекции" value={data.totals.detections} detail="AI alerts" icon={Radio} tone="amber" />
        <StatCard label="Подтверждено" value={data.totals.confirmedIncidents} detail="оператором" icon={Crosshair} tone="red" />
        <StatCard label="Закрыто" value={data.totals.resolvedIncidents} detail="инцидентов" icon={CheckCircle2} tone="green" />
        <StatCard label="Средний ответ" value={`${data.totals.averageResponseMin} м`} detail="по данным БД" icon={Activity} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="card p-4">
          <h2 className="mb-4 font-extrabold">Инциденты по дням</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.byDay}><CartesianGrid stroke="#E3E6EA" /><XAxis dataKey="day" /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="count" stroke="#0f87a8" strokeWidth={3} /></LineChart>
          </ResponsiveContainer>
        </section>
        <section className="card p-4">
          <h2 className="mb-4 font-extrabold">Инциденты по типу</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.byType.map((item) => ({ ...item, label: incidentTypeLabel[item.type] }))}><CartesianGrid stroke="#E3E6EA" /><XAxis dataKey="label" hide /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#0f87a8" radius={[8, 8, 0, 0]} /></BarChart>
          </ResponsiveContainer>
        </section>
        <section className="card p-4">
          <h2 className="mb-4 font-extrabold">Статусы</h2>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart><Pie data={data.byStatus.filter((item) => item.count > 0).map((item) => ({ ...item, label: incidentStatusLabel[item.status] }))} dataKey="count" nameKey="label" outerRadius={100}>{data.byStatus.map((_, index) => <Cell key={index} fill={["#0f87a8", "#12b76a", "#f79009", "#d92d20", "#667085"][index % 5]} />)}</Pie><Tooltip /></PieChart>
          </ResponsiveContainer>
        </section>
        <section className="card p-4">
          <h2 className="font-extrabold">AI operator feedback</h2>
          <p className="mt-2 text-sm text-muted">Доля подтверждений оператором, не “model accuracy”.</p>
          <div className="mt-6 text-5xl font-extrabold">{confirmShare}%</div>
          <div className="mt-3 h-3 rounded-full bg-[#f1f3f5]"><div className="h-3 rounded-full bg-[#12b76a]" style={{ width: `${confirmShare}%` }} /></div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center text-sm">
            <div className="rounded-2xl bg-[#f1f3f5] p-3"><b>{data.feedback.total}</b><br />alerts</div>
            <div className="rounded-2xl bg-[#eaf8f0] p-3"><b>{data.feedback.confirmed}</b><br />confirmed</div>
            <div className="rounded-2xl bg-[#fff0ef] p-3"><b>{data.feedback.falseAlarms}</b><br />false</div>
          </div>
        </section>
      </div>
    </div>
  );
}
