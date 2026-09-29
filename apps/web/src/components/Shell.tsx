import { Archive, Bell, Bot, ChartNoAxesCombined, Crosshair, Database, Drone, FileText, LifeBuoy, LogOut, Map, Radio, Search, Settings, ShieldCheck } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useOverview } from "../hooks/useOverview";
import { api } from "../services/api";
import type { DroneConnection } from "../types/domain";
import { useAuth } from "../auth";

const nav = [
  { to: "/overview", label: "Обзор", icon: Map, section: "" },
  { to: "/live", label: "Live", icon: Radio, section: "ОПЕРАЦИИ" },
  { to: "/incidents", label: "Инциденты", icon: Crosshair, section: "" },
  { to: "/search", label: "Поиск человека", icon: Search, section: "" },
  { to: "/patrols", label: "Патрули", icon: ShieldCheck, section: "" },
  { to: "/playback", label: "Архив / Playback", icon: Archive, section: "АНАЛИЗ" },
  { to: "/evidence", label: "Доказательства", icon: FileText, section: "" },
  { to: "/analytics", label: "Аналитика", icon: ChartNoAxesCombined, section: "" },
  { to: "/drones", label: "Дроны", icon: Drone, section: "СИСТЕМА" }
];

export function Shell() {
  const { user, logout, isController } = useAuth();
  const { data, refresh } = useOverview();
  const [connectionState, setConnectionState] = useState<DroneConnection | null | undefined>(undefined);
  const [sessionOverride, setSessionOverride] = useState<DroneConnection | null | undefined>(undefined);
  const [panelOpen, setPanelOpen] = useState(false);
  const time = useMemo(() => new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(new Date()).toUpperCase(), []);
  const activeConnection = sessionOverride !== undefined ? sessionOverride : connectionState !== undefined ? connectionState : data?.activeConnection;
  const visibleNav = isController ? [...nav, { to: "/controller", label: "Контроллер", icon: Database, section: "ДОСТУП" }] : nav;

  useEffect(() => {
    let mounted = true;
    api.activeConnection()
      .then((connection) => {
        if (mounted) setConnectionState(connection);
      })
      .catch(() => {
        if (mounted) setConnectionState(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[72px_1fr]">
      <aside className="boltzzmann-rail hidden border-r border-line px-2 py-3 lg:flex lg:flex-col">
        <div className="mb-5 grid place-items-center border-b border-line pb-3">
          <div className="grid h-11 w-11 place-items-center cut-corner bg-[#087F73] text-white">
            <LifeBuoy size={23} />
          </div>
        </div>
        <nav className="space-y-1.5">
          {visibleNav.map((item) => (
            <div key={item.to}>
              {item.section && <div className="mx-auto my-3 h-px w-8 bg-line" />}
              <NavLink
                to={item.to}
                title={item.label}
                className={({ isActive }) =>
                  `group relative grid h-11 w-full place-items-center border text-sm font-bold transition ${
                    isActive ? "border-[#087F73] bg-[#FAF9F5] text-[#087F73]" : "border-transparent text-[#69736F] hover:border-line hover:bg-[#FAF9F5]"
                  }`
                }
              >
                <item.icon size={18} />
                <span className="pointer-events-none absolute left-[58px] z-[80] hidden whitespace-nowrap border border-line bg-[#FAF9F5] px-2 py-1 text-xs text-ink shadow-soft group-hover:block">
                  {item.label}
                </span>
              </NavLink>
            </div>
          ))}
        </nav>
        <div className="mt-auto border-t border-line pt-3">
          <button className="grid h-11 w-full place-items-center border border-transparent text-muted hover:border-line hover:bg-[#FAF9F5]" title={`${user?.name} / выйти`} onClick={logout}>
            <LogOut size={18} />
          </button>
          <button className="grid h-11 w-full place-items-center border border-transparent text-muted hover:border-line hover:bg-[#FAF9F5]" title="Настройки">
            <Settings size={18} />
          </button>
        </div>
      </aside>
      <main className="min-w-0">
        <header className="boltzzmann-topbar sticky top-0 z-20 border-b border-line px-3 py-2 md:px-4">
          <div className="grid gap-2 xl:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.9fr)]">
            <div className="flex min-w-0 items-center gap-3">
              <span className="status-dot" />
              <div className="min-w-0">
                <div className="ops-label">Boltzzmann / AKTAU COASTAL OPS</div>
                <div className="truncate text-sm font-extrabold">Система работает <span className="mono text-xs text-muted">/ DATABASE LIVE</span></div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-start gap-x-4 gap-y-1 text-xs text-muted xl:justify-end">
              <span className="mono">DRONE <b className="text-ink">{activeConnection?.drone.name.replace("Boltzzmann-", "B-") ?? "..."}</b></span>
              <span className="mono">LINK <b className="text-ink">98%</b></span>
              <span className="mono">GPS <b className="text-ink">14 SAT</b></span>
              <span className="mono">SEA <b className="text-ink">{data?.sea.waveHeight?.toFixed(1) ?? "..."}M</b></span>
              <span className="mono">WIND <b className="text-ink">{data?.sea.windSpeed?.toFixed(1) ?? "..."}M/S</b></span>
              <span className="mono">INC <b className="text-ink">{data?.stats.activeIncidents ?? "..."}</b></span>
              <span className="mono">ROLE <b className="text-ink">{user?.role === "CONTROLLER" ? "CONTROL" : "WATCH"}</b></span>
              {activeConnection && (
                <button className="btn cut-corner px-3 py-1 text-[11px]" onClick={() => setPanelOpen((value) => !value)}>
                  DRN / {activeConnection.drone.name.replace("Boltzzmann-", "B-")} · BAT {activeConnection.drone.battery}%
                </button>
              )}
              <span className="mono">{time}</span>
              <Bell size={18} />
              <Bot size={18} />
            </div>
          </div>
          {panelOpen && activeConnection && (
            <div className="ops-panel absolute right-6 top-14 z-30 w-80 p-4 shadow-soft">
              <div className="mono text-xs text-muted">{activeConnection.serialNumber}</div>
              <h3 className="text-xl font-extrabold">{activeConnection.drone.name}</h3>
              <p className="text-sm text-muted">{activeConnection.selectedModel} · OPERATIONAL CONNECTION</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-bold">
                <div className="border border-line bg-[#F2F0E9] p-2">GPS<br />READY</div>
                <div className="border border-line bg-[#F2F0E9] p-2">CAM<br />ONLINE</div>
                <div className="border border-line bg-[#F2F0E9] p-2">BAT<br />{activeConnection.drone.battery}%</div>
              </div>
              <button
                className="btn mt-4 w-full"
                onClick={async () => {
                  if (window.confirm("Отключить активную сессию дрона?")) {
                    await api.disconnectSession();
                    setConnectionState(null);
                    setSessionOverride(null);
                    setPanelOpen(false);
                    await refresh();
                  }
                }}
              >
                Отключить
              </button>
            </div>
          )}
        </header>
        <div className="fade-up">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
