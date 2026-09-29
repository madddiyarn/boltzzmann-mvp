import { Camera, CheckCircle2, MapPin, Plus, Search, XCircle } from "lucide-react";
import { useState } from "react";
import { Circle, Marker, Polyline, MapContainer, Popup, TileLayer, useMapEvents } from "react-leaflet";
import { api } from "../services/api";
import { useOverview } from "../hooks/useOverview";

function ClickTarget({ onPick }: { onPick: (point: [number, number]) => void }) {
  useMapEvents({
    click(event) {
      onPick([event.latlng.lat, event.latlng.lng]);
    }
  });
  return null;
}

export function SearchPage() {
  const { data, refresh } = useOverview();
  const [point, setPoint] = useState<[number, number]>([43.6218, 51.1567]);
  const [radius, setRadius] = useState(650);
  const [tag, setTag] = useState("");
  const [tags, setTags] = useState(["Красная куртка", "Черный рюкзак"]);
  const [description, setDescription] = useState("Мужчина, последний раз замечен возле скал.");
  const [approximateTime, setApproximateTime] = useState(new Date().toISOString().slice(0, 16));
  const [visualReferenceUrl, setVisualReferenceUrl] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    await api.createMission({
      centerLatitude: point[0],
      centerLongitude: point[1],
      radius,
      approximateTime: new Date(approximateTime).toISOString(),
      description,
      distinctiveItems: tags,
      visualReferenceUrl
    });
    setMessage("Поисковая миссия создана в PostgreSQL.");
    await refresh();
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[430px_minmax(0,1fr)]">
      <section className="card p-4">
        <h1 className="text-2xl font-extrabold">Поиск человека</h1>
        <p className="mt-2 text-sm text-muted">Выберите примерную точку на карте, радиус и визуальные признаки. Распознавание лиц не используется.</p>
        <label className="mt-5 block text-sm font-bold">Радиус поиска, м</label>
        <input className="mt-2 w-full accent-[#0f87a8]" type="range" min={150} max={1500} step={50} value={radius} onChange={(event) => setRadius(Number(event.target.value))} />
        <div className="mono text-sm font-bold">{radius} м</div>
        <label className="mt-4 block text-sm font-bold">Описание</label>
        <textarea className="mt-2 min-h-28 w-full rounded-2xl border border-line p-3" value={description} onChange={(event) => setDescription(event.target.value)} />
        <label className="mt-4 block text-sm font-bold">Примерное время / последний раз видели</label>
        <input className="mono mt-2 w-full rounded-2xl border border-line px-3 py-2" type="datetime-local" value={approximateTime} onChange={(event) => setApproximateTime(event.target.value)} />
        <label className="mt-4 block text-sm font-bold">Визуальный ориентир</label>
        <div className="mt-2 rounded-2xl border border-dashed border-line p-3">
          <div className="flex items-center gap-2 text-sm font-bold"><Camera size={16} /> Optional upload / reference URL</div>
          <input className="mt-2 w-full rounded-full border border-line px-3 py-2 text-sm" value={visualReferenceUrl} onChange={(event) => setVisualReferenceUrl(event.target.value)} />
          <p className="mt-2 text-xs text-muted">Facial recognition не используется. Ссылка сохраняется в PostgreSQL как ориентир для операторов.</p>
        </div>
        <label className="mt-4 block text-sm font-bold">Отличительные предметы</label>
        <div className="mt-2 flex gap-2">
          <input className="min-w-0 flex-1 rounded-full border border-line px-3 py-2" value={tag} onChange={(event) => setTag(event.target.value)} placeholder="Белая кепка" />
          <button className="btn" onClick={() => { if (tag.trim()) setTags([...tags, tag.trim()]); setTag(""); }}><Plus size={16} /></button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((item) => <span key={item} className="rounded-full bg-[#e7f6fa] px-3 py-1 text-xs font-bold text-[#0f6f8a]">{item}</span>)}
        </div>
        <button className="btn btn-primary mt-5 w-full" onClick={submit}><Search size={16} /> Начать поиск</button>
        {message && <p className="mt-3 rounded-2xl bg-[#eaf8f0] p-3 text-sm font-semibold text-[#067647]">{message}</p>}
      </section>
      <section className="space-y-5">
        <div className="card h-[540px] p-3">
          <MapContainer center={point} zoom={13} className="h-full">
            <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <ClickTarget onPick={setPoint} />
            <Marker position={point}><Popup>Центр поиска</Popup></Marker>
            <Circle center={point} radius={radius} pathOptions={{ color: "#0f87a8", fillOpacity: 0.08 }} />
            {(data?.sightings ?? []).map((sighting) => (
              <Marker key={sighting.id} position={[sighting.latitude, sighting.longitude]}><Popup>{String(sighting.metadata.label ?? sighting.sourceType)}</Popup></Marker>
            ))}
            {(data?.missions ?? []).flatMap((mission) => mission.driftPredictions ?? []).flatMap((prediction) => prediction.areas.map((area) => (
              <Circle key={`${prediction.id}-${area.label}`} center={[area.latitude, area.longitude]} radius={area.radius} pathOptions={{ color: "#0f87a8", fillOpacity: 0.04, dashArray: "8 8" }} />
            )))}
            {(data?.sightings ?? []).length > 1 && (
              <Polyline positions={(data?.sightings ?? []).map((sighting) => [sighting.latitude, sighting.longitude] as [number, number])} pathOptions={{ color: "#d92d20", weight: 3 }} />
            )}
          </MapContainer>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {(data?.missions ?? []).map((mission) => (
            <div key={mission.id} className="card p-4">
              <div className="flex items-center gap-2"><MapPin size={17} className="text-[#0f87a8]" /><b className="mono">{mission.publicId}</b></div>
              <p className="mt-2 text-sm">{mission.description}</p>
              <div className="mt-3 text-sm text-muted">Проверено: {mission.areaChecked}% · кандидатов: {mission.candidates.length}</div>
              <div className="mt-3 h-2 rounded-full bg-[#f1f3f5]"><div className="h-2 rounded-full bg-[#0f87a8]" style={{ width: `${mission.areaChecked}%` }} /></div>
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn px-3 py-1 text-xs" onClick={async () => { await api.createDrift({ searchMissionId: mission.id, latitude: mission.centerLatitude, longitude: mission.centerLongitude, elapsedMinutes: 20 }); await refresh(); }}>Drift</button>
              </div>
              <div className="mt-4 space-y-2">
                {(mission.sightings ?? []).map((sighting) => (
                  <div key={sighting.id} className="rounded-2xl bg-[#f1f3f5] p-2 text-xs">
                    <b>{String(sighting.metadata.label ?? sighting.sourceType)}</b><br />
                    <span className="mono text-muted">{new Date(sighting.timestamp).toLocaleTimeString("ru-RU")} · {sighting.confidence}%</span>
                  </div>
                ))}
                {mission.candidates.map((candidate, index) => (
                  <div key={candidate.id} className="rounded-2xl border border-line p-3">
                    <div className="font-extrabold">POSSIBLE MATCH #{String(index + 1).padStart(2, "0")}</div>
                    <div className="mt-1 text-sm text-muted">Visual similarity: {candidate.visualSimilarity}% · AI {candidate.confidence}%</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {candidate.matchedItems.map((item) => <span key={item} className="rounded-full bg-[#eaf8f0] px-2 py-1 text-xs font-bold text-[#067647]">{item} ✓</span>)}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button className="btn px-3 py-1 text-xs">Открыть</button>
                      <button className="btn px-3 py-1 text-xs" onClick={async () => { await api.updateCandidate(candidate.id, "POSSIBLE_TARGET"); await refresh(); }}><CheckCircle2 size={14} /> Возможная цель</button>
                      <button className="btn px-3 py-1 text-xs" onClick={async () => { await api.updateCandidate(candidate.id, "REJECTED"); await refresh(); }}><XCircle size={14} /> Не совпадает</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
