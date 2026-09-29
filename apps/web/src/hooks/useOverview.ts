import { useCallback, useEffect, useState } from "react";
import { api } from "../services/api";
import { socket } from "../services/socket";
import type { Overview } from "../types/domain";

export function useOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const overview = await api.overview();
      setData(overview);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const handler = () => void refresh();
    const events = [
      "dashboard:update",
      "incident:created",
      "incident:updated",
      "incident.created",
      "incident.updated",
      "incident.dispatched",
      "incident.resolved",
      "rescue:update",
      "rescue:dispatch",
      "rescue.assigned",
      "rescue.accepted",
      "rescue.arrived",
      "rescue.completed",
      "drone.connected",
      "drone.disconnected",
      "search.created",
      "search.candidate",
      "search.target_confirmed",
      "evidence.created",
      "drift.created",
      "print.printed",
      "weather.updated",
      "marine.updated",
      "offline.synced",
      "patrol:created"
    ];
    events.forEach((event) => socket.on(event, handler));
    const interval = window.setInterval(handler, 5000);
    return () => {
      events.forEach((event) => socket.off(event, handler));
      window.clearInterval(interval);
    };
  }, [refresh]);

  return { data, loading, error, refresh };
}
