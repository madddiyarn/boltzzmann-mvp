import { FileText, Printer, QrCode } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../services/api";
import type { Evidence } from "../types/domain";
import { incidentTypeLabel } from "../i18n/ru";

export function EvidencePage() {
  const [items, setItems] = useState<Evidence[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    api.evidence().then((payload) => {
      setItems(payload);
      setSelectedId(payload[0]?.id ?? "");
    }).catch(() => setItems([]));
  }, []);

  const selected = items.find((item) => item.id === selectedId) ?? items[0];

  return (
    <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
      <section className="card p-4">
        <h1 className="text-2xl font-extrabold">Доказательства</h1>
        <p className="mt-2 text-sm text-muted">Evidence packages формируются из событий и вложений, сохранённых в PostgreSQL.</p>
        <div className="mt-4 space-y-2">
          {items.map((item) => (
            <button key={item.id} className={`w-full rounded-2xl border p-3 text-left ${selected?.id === item.id ? "border-[#0f87a8] bg-[#e7f6fa]" : "border-line bg-white"}`} onClick={() => setSelectedId(item.id)}>
              <div className="mono text-xs text-muted">{item.publicId}</div>
              <div className="font-extrabold">{item.incident.publicId}</div>
              <div className="text-sm text-muted">{incidentTypeLabel[item.incident.type]}</div>
            </button>
          ))}
        </div>
      </section>
      <section className="card p-5">
        {selected ? (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="mono text-sm text-muted">{selected.publicId}</div>
                <h2 className="text-3xl font-extrabold">Boltzzmann EMERGENCY REPORT</h2>
              </div>
              <button className="btn" onClick={() => window.print()}><Printer size={16} /> Сформировать отчёт</button>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_180px]">
              <div className="rounded-2xl border border-line p-4">
                <div dangerouslySetInnerHTML={{ __html: selected.reportHtml }} />
                <div className="mt-4 grid gap-2 text-sm">
                  <div><b>Timeline:</b> {selected.incident.events?.length ?? 0} событий</div>
                  <div><b>Final result:</b> {selected.incident.status}</div>
                  <div><b>Coordinates:</b> <span className="mono">{selected.incident.latitude.toFixed(5)}, {selected.incident.longitude.toFixed(5)}</span></div>
                </div>
              </div>
              <div className="grid place-items-center rounded-2xl border border-line p-4 text-center">
                <QrCode size={96} />
                <div className="mono mt-3 text-xs text-muted">{selected.qrPayload}</div>
              </div>
            </div>
            <h3 className="mt-6 font-extrabold">Assets</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {selected.assets.map((asset) => (
                <div key={asset.id} className="rounded-2xl border border-line p-3">
                  <div className="flex items-center gap-2 font-bold"><FileText size={16} /> {asset.label}</div>
                  <div className="mono mt-2 text-xs text-muted">{asset.type} · {asset.url}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="grid min-h-[480px] place-items-center text-muted">Evidence packages пока не созданы.</div>
        )}
      </section>
    </div>
  );
}
