import { CheckCircle2, Drone, Loader2, QrCode, Radio, ScanLine, Unplug } from "lucide-react";
import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { api } from "../services/api";
import type { DroneConnection } from "../types/domain";

const models = ["DJI Avata 2", "DJI Mavic 3 Enterprise", "DJI Matrice 30", "Other Drone"];
const djiSteps = ["Поиск устройства...", "Устройство найдено", "Установка соединения", "Получение телеметрии", "Синхронизация камеры", "Подключено"];
const qrSteps = ["QR отсканирован", "Проверка устройства", "Дрон найден", "Подключено"];

type ConnectionMethod = "QR" | "DJI_APP" | "SERIAL";
type GatewayMode = "idle" | "qr-ready" | "connecting";

export function ConnectionGateway({ onConnected }: { onConnected: (connection: DroneConnection) => void }) {
  const [model, setModel] = useState(models[0]);
  const [serialNumber, setSerialNumber] = useState("AVATA2-X8K29");
  const [mode, setMode] = useState<GatewayMode>("idle");
  const [method, setMethod] = useState<ConnectionMethod | null>(null);
  const [stepIndex, setStepIndex] = useState<number | null>(null);
  const [connected, setConnected] = useState<DroneConnection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = mode === "connecting";
  const qrPayload = JSON.stringify({
    app: "Boltzzmann",
    type: "DRONE_INIT",
    model,
    serialNumber: serialNumber.trim() || "QR-OPS",
    station: "AKTAU_COASTAL_OPS",
    issuedAt: new Date(2026, 8, 24, 15, 20, 42).toISOString()
  });

  async function connect(nextMethod: ConnectionMethod) {
    setError(null);
    setMethod(nextMethod);
    setMode("connecting");
    const steps = nextMethod === "DJI_APP" ? djiSteps : nextMethod === "QR" ? qrSteps : ["Проверка серийного номера", "Регистрация сессии", "Подключено"];

    for (let i = 0; i < steps.length; i += 1) {
      setStepIndex(i);
      await new Promise((resolve) => setTimeout(resolve, nextMethod === "DJI_APP" ? 680 : 460));
    }

    try {
      const connection = await api.connectSession({ model, method: nextMethod, serialNumber: serialNumber.trim() || undefined });
      setConnected(connection);
    } catch (connectError) {
      setError(connectError instanceof Error ? connectError.message : "Не удалось подключить дрон");
    } finally {
      setStepIndex(null);
      setMode("idle");
    }
  }

  function showQr() {
    setError(null);
    setMethod("QR");
    setStepIndex(null);
    setMode("qr-ready");
  }

  if (connected) {
    return (
      <main className="grid min-h-screen place-items-center bg-base p-6">
        <section className="ops-panel cut-corner fade-up max-w-xl p-8 text-center shadow-soft">
          <CheckCircle2 className="success-pop mx-auto text-[#12b76a]" size={44} />
          <div className="ops-label mt-4">DRONE INITIALIZATION COMPLETE</div>
          <h1 className="mt-2 text-3xl font-extrabold">ДРОН ПОДКЛЮЧЕН</h1>
          <p className="mt-2 text-muted">{connected.selectedModel}</p>
          <p className="mono mt-1 text-sm text-muted">SN: {connected.serialNumber}</p>
          <div className="mt-6 grid grid-cols-3 gap-px bg-line text-sm font-bold">
            <div className="bg-[#F2F0E9] p-3">GPS<br />READY</div>
            <div className="bg-[#F2F0E9] p-3">CAM<br />ONLINE</div>
            <div className="bg-[#F2F0E9] p-3">TLM<br />ONLINE</div>
          </div>
          <button className="btn btn-primary cut-corner mt-6 w-full" onClick={() => onConnected(connected)}>ОТКРЫТЬ COMMAND CENTER</button>
        </section>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-base p-6">
      <section className="ops-panel gateway-shell grid w-full max-w-6xl gap-0 overflow-hidden shadow-soft lg:grid-cols-[0.95fr_1.05fr]">
        <div className="gateway-hero p-6">
          <div className="flex items-center justify-between border-b border-line pb-4">
            <div>
              <div className="ops-label">Boltzzmann / DRONE INITIALIZATION</div>
              <h1 className="mt-1 text-3xl font-extrabold">Подключите дрон</h1>
            </div>
            <div className="grid h-12 w-12 place-items-center cut-corner bg-[#087F73] text-white">
              <Drone size={25} />
            </div>
          </div>
          <div className="drone-schematic mt-6">
            {mode === "qr-ready" && <div className="scan-line" />}
            <div className="absolute bottom-4 left-4 mono text-xs font-bold text-muted">MODEL / {model.toUpperCase()}</div>
            <div className="absolute right-4 top-4 mono text-xs font-bold text-[#087F73]">SEC / AKT-OPS</div>
          </div>
          <p className="mt-4 max-w-md text-sm text-muted">Для начала работы подключите совместимый дрон к системе Boltzzmann. Сессия подключения сохраняется в PostgreSQL и используется в командном центре.</p>
          <div className="mt-5 border border-line bg-[#FAF9F5]/70 p-3">
            <div className="ops-label">CONNECTION STATE</div>
            <div className="mono mt-1 text-xs font-bold text-[#69736F]">SESSION / TELEMETRY / CAMERA STATUS</div>
          </div>
        </div>
        <div className="border-l border-line bg-[#FAF9F5] p-6">
          <div className="ops-label">CONNECTION TERMINAL</div>
          <label className="mt-4 block text-sm font-extrabold text-muted">Модель дрона</label>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {models.map((item) => (
              <button key={item} disabled={busy} className={`btn justify-start ${model === item ? "btn-primary" : ""}`} onClick={() => setModel(item)}>{item}</button>
            ))}
          </div>
          <label className="mt-5 block text-sm font-extrabold text-muted">Серийный номер</label>
          <input
            className="mono mt-2 w-full rounded-2xl border border-line px-4 py-3"
            value={serialNumber}
            disabled={busy}
            onChange={(event) => setSerialNumber(event.target.value)}
            placeholder="Серийный номер"
          />

          {mode === "qr-ready" && (
            <div className="fade-up mt-5 border border-[#087F73]/30 bg-[#F2F0E9] p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-extrabold">QR для подключения</h3>
                  <p className="mt-1 text-sm text-muted">Наведите scanner на QR. Загрузка начнётся только после сканирования.</p>
                </div>
                <span className="ops-label text-[#087F73]">VALID QR</span>
              </div>
              <div className="mx-auto mt-4 grid w-52 place-items-center border border-line bg-white p-4">
                <QRCodeSVG
                  value={qrPayload}
                  size={176}
                  level="M"
                  marginSize={1}
                  bgColor="#ffffff"
                  fgColor="#17201E"
                />
              </div>
              <p className="mono mx-auto mt-3 max-w-sm break-all text-center text-[10px] font-bold text-muted">{qrPayload}</p>
              <button className="btn btn-primary mt-4 w-full" onClick={() => connect("QR")}>
                <ScanLine size={17} /> QR отсканирован
              </button>
            </div>
          )}

          <div className="mt-6 grid gap-3">
            <button className="btn" disabled={busy} onClick={showQr}><QrCode size={17} /> Показать QR</button>
            <button className="btn" disabled={busy} onClick={() => connect("DJI_APP")}><Radio size={17} /> Подключить через DJI</button>
            <button className="btn btn-primary" disabled={busy} onClick={() => connect("SERIAL")}><Unplug size={17} /> Подключить по серийному номеру</button>
          </div>
          {stepIndex !== null && (
            <div className="fade-up mt-5 border border-line bg-[#17201E] p-4 text-[#FAF9F5]">
              <div className="ops-label text-[#97aaa3]">SYSTEM LOG</div>
              <div className="flex items-center gap-2 font-bold">
                <Loader2 className="spin-soft text-[#FF5A36]" size={17} />
                {(method === "DJI_APP" ? djiSteps : method === "QR" ? qrSteps : ["Проверка серийного номера", "Регистрация сессии", "Подключено"])[stepIndex]}
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                <div
                  className="progress-flow h-2 rounded-full bg-[#0f87a8]"
                  style={{ width: `${((stepIndex + 1) / (method === "DJI_APP" ? djiSteps.length : method === "QR" ? qrSteps.length : 3)) * 100}%` }}
                />
              </div>
            </div>
          )}
          {error && <p className="mt-4 rounded-2xl bg-[#fff0ef] p-3 text-sm font-bold text-[#b42318]">{error}</p>}
        </div>
      </section>
    </main>
  );
}
