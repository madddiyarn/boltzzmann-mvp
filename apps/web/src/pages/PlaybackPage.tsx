import { GitCompare, MapPin, Play, Radar } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import { api } from "../services/api";
import type { Recording } from "../types/domain";

export function PlaybackPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [offset, setOffset] = useState(660);
  const [fromMinute, setFromMinute] = useState(0);
  const [toMinute, setToMinute] = useState(10);
  const [clipReady, setClipReady] = useState(false);
  const [overlay, setOverlay] = useState(true);
  const [highlightVision, setHighlightVision] = useState(false);
  const [events, setEvents] = useState(true);
  const [mapSync, setMapSync] = useState(true);

  useEffect(() => {
    api.playback().then((items) => {
      setRecordings(items);
      setSelectedId(items[0]?.id ?? "");
    }).catch(() => setRecordings([]));
  }, []);

  const selected = useMemo(() => recordings.find((item) => item.id === selectedId) ?? recordings[0], [recordings, selectedId]);
  const fromSec = fromMinute * 60;
  const toSec = Math.max(fromSec + 60, toMinute * 60);
  const visibleEvents = selected?.events.filter((event) => event.offsetSec >= fromSec && event.offsetSec <= toSec) ?? [];
  const activeEvent = (visibleEvents.length ? visibleEvents : selected?.events)?.reduce((best, event) => Math.abs(event.offsetSec - offset) < Math.abs(best.offsetSec - offset) ? event : best, (visibleEvents[0] ?? selected?.events[0]));
  const route = selected?.events.filter((event) => event.latitude && event.longitude).map((event) => [event.latitude!, event.longitude!] as [number, number]) ?? [];

  if (!selected) return <div className="card p-6 text-muted">Архив записей пока пуст.</div>;

  if (!clipReady) {
    return (
      <div className="grid min-h-[calc(100vh-90px)] place-items-center p-4">
        <section className="ops-panel cut-corner w-full max-w-2xl p-6">
          <div className="ops-label">PLAYBACK / TIME WINDOW</div>
          <h1 className="mt-2 text-3xl font-extrabold">Выберите фрагмент записи</h1>
          <p className="mt-2 text-muted">Сначала задайте, с какой минуты по какую показать видео. После этого откроется архивный просмотр.</p>
          <label className="mt-5 block text-sm font-extrabold text-muted">Запись</label>
          <select className="field mt-2 w-full" value={selected.id} onChange={(event) => setSelectedId(event.target.value)}>
            {recordings.map((recording) => <option key={recording.id} value={recording.id}>{recording.publicId} · {recording.mission}</option>)}
          </select>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-extrabold text-muted">
              С минуты
              <input className="field mt-2 w-full" type="number" min={0} max={180} value={fromMinute} onChange={(event) => setFromMinute(Number(event.target.value))} />
            </label>
            <label className="block text-sm font-extrabold text-muted">
              По минуту
              <input className="field mt-2 w-full" type="number" min={1} max={240} value={toMinute} onChange={(event) => setToMinute(Number(event.target.value))} />
            </label>
          </div>
          <button
            className="btn btn-primary cut-corner mt-6 w-full"
            onClick={() => {
              setOffset(fromSec);
              setClipReady(true);
            }}
          >
            <Play size={17} /> Показать фрагмент
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_420px]">
      <section className="card overflow-hidden p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mono text-sm text-muted">{selected.publicId}</div>
            <h1 className="text-2xl font-extrabold">Архив / Playback</h1>
          </div>
          <select className="field" value={selected.id} onChange={(event) => { setSelectedId(event.target.value); setClipReady(false); }}>
            {recordings.map((recording) => <option key={recording.id} value={recording.id}>{recording.mission}</option>)}
          </select>
        </div>
        <div className="relative mt-4 min-h-[520px] overflow-hidden rounded-[6px] border border-line bg-[#dfeaf0]">
          <img
            src={highlightVision ? "/media/coast-highlight.png" : "/media/coast-original.png"}
            alt="Coastal playback frame"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(23,32,30,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(23,32,30,0.08)_1px,transparent_1px)] bg-[length:54px_54px]" />
          <div className="absolute left-4 top-4 border border-line bg-[#FAF9F5]/90 px-3 py-2 font-mono text-xs font-bold">
            ARCHIVE · WINDOW {fromMinute}:00 - {Math.max(fromMinute + 1, toMinute)}:00
          </div>
          <div className="absolute right-4 top-4 border border-line bg-[#FAF9F5]/90 px-3 py-2 font-mono text-xs font-bold">
            {highlightVision ? "VISION / PEOPLE + SEA" : "RAW / CAMERA"}
          </div>
          {overlay && activeEvent?.type === "AI_ALERT" && !highlightVision && (
            <div className="absolute left-[42%] top-[31%] h-[26%] w-[18%] border-2 border-[#FF5A36] bg-[#FF5A36]/5">
              <div className="absolute -top-8 left-0 bg-[#FF5A36] px-2 py-1 font-mono text-xs font-bold text-white">AI OVERLAY · 91%</div>
            </div>
          )}
          <div className="absolute bottom-4 left-4 right-4 border border-line bg-[#FAF9F5]/92 p-4">
            <input className="w-full accent-[#0f87a8]" type="range" min={fromSec} max={toSec} value={offset} onChange={(event) => setOffset(Number(event.target.value))} />
            <div className="mt-2 flex justify-between text-xs font-bold text-muted">
              <span>{fromMinute}:00</span><span className="mono">offset {offset}s</span><span>{Math.max(fromMinute + 1, toMinute)}:00</span>
            </div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className={`btn ${highlightVision ? "btn-primary" : ""}`} onClick={() => setHighlightVision(!highlightVision)}><Radar size={16} /> Highlight people and sea</button>
          <button className={`btn ${overlay ? "btn-primary" : ""}`} onClick={() => setOverlay(!overlay)}><Radar size={16} /> AI OVERLAY</button>
          <button className={`btn ${events ? "btn-primary" : ""}`} onClick={() => setEvents(!events)}>EVENTS</button>
          <button className={`btn ${mapSync ? "btn-primary" : ""}`} onClick={() => setMapSync(!mapSync)}>MAP SYNC</button>
          <button className="btn" onClick={() => setClipReady(false)}>Выбрать другой интервал</button>
        </div>
      </section>

      <aside className="space-y-5">
        <div className="card h-[330px] p-3">
          <MapContainer center={[activeEvent?.latitude ?? 43.646, activeEvent?.longitude ?? 51.149]} zoom={12} className="h-full">
            <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            {mapSync && route.length > 1 && <Polyline positions={route} pathOptions={{ color: "#0f87a8", weight: 3 }} />}
            {selected.events.filter((event) => event.latitude && event.longitude).map((event) => (
              <Marker key={event.id} position={[event.latitude!, event.longitude!]}><Popup>{event.label}</Popup></Marker>
            ))}
            {selected.changes.map((change) => (
              <CircleMarker key={change.id} center={[change.latitude, change.longitude]} radius={10} pathOptions={{ color: "#f79009", fillOpacity: 0.2 }} />
            ))}
          </MapContainer>
        </div>
        <div className="card p-4">
          <h2 className="font-extrabold">Timeline events</h2>
          <div className="mt-3 space-y-2">
            {events && visibleEvents.map((event) => (
              <button key={event.id} className="w-full rounded-2xl border border-line p-3 text-left hover:border-[#0f87a8]" onClick={() => setOffset(event.offsetSec)}>
                <div className="mono text-xs text-muted">{new Date(event.timestamp).toLocaleTimeString("ru-RU")} · {event.offsetSec}s</div>
                <div className="font-bold">{event.label}</div>
              </button>
            ))}
          </div>
        </div>
        <div className="card p-4">
          <div className="flex items-center gap-2"><GitCompare size={18} className="text-[#f79009]" /><h2 className="font-extrabold">Change Detection</h2></div>
          <div className="mt-3 space-y-2">
            {selected.changes.map((change) => (
              <div key={change.id} className="rounded-2xl bg-[#fff5dc] p-3 text-sm">
                <b>{change.type}</b> · {change.confidence}%<br />
                <span className="text-muted">{change.compareLabelA} vs {change.compareLabelB}</span>
                <div className="mt-1 flex items-center gap-1 font-mono text-xs text-muted"><MapPin size={13} /> {change.latitude.toFixed(4)}, {change.longitude.toFixed(4)}</div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
