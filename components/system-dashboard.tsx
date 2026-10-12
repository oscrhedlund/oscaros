"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity, AlertTriangle, Check, ChartNoAxesCombined, CircleHelp, Clock3, Container, Cpu,
  ExternalLink, HardDrive, LoaderCircle, MemoryStick, RotateCw, Server, Settings2,
  ShieldAlert, Wrench, X,
} from "lucide-react";
import {
  CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type {
  BeszelContainerHistoryPoint, BeszelDashboard, BeszelHistoryPoint, BeszelHistoryRange, BeszelSystem,
} from "@/lib/beszel";
import type { ServiceStatus, SystemStatus } from "@/lib/system-status";

type DashboardStatus = BeszelDashboard | SystemStatus;
type MetricKey = "cpu" | "memory" | "disk" | "uptime" | "containers";
type DashboardPreferences = {
  knownSystemIds: string[];
  visibleSystemIds: string[];
  metricsBySystem: Record<string, MetricKey[]>;
};

const preferenceKey = "personal-os-system-dashboard-v1";
const allMetrics: { key: MetricKey; label: string }[] = [
  { key: "cpu", label: "CPU" },
  { key: "memory", label: "Minne" },
  { key: "disk", label: "Disk" },
  { key: "uptime", label: "Drifttid" },
  { key: "containers", label: "Containrar" },
];
const defaultMetrics: MetricKey[] = allMetrics.map((metric) => metric.key);
const rangeOptions: { value: BeszelHistoryRange; label: string }[] = [
  { value: "1h", label: "Senaste timmen" },
  { value: "6h", label: "Senaste 6 timmarna" },
  { value: "24h", label: "Senaste 24 timmarna" },
  { value: "7d", label: "Senaste 7 dagarna" },
];
const metricColors = { cpuPercent: "#8b7cff", memoryPercent: "#48c6a9", diskPercent: "#f3ad55" };

const statusLabel: Record<ServiceStatus, string> = {
  operational: "Tillgänglig",
  degraded: "Nedsatt",
  outage: "Avbrott",
  maintenance: "Underhåll",
  unknown: "Okänd",
};

function StatusIcon({ status }: { status: ServiceStatus }) {
  if (status === "operational") return <Check size={15} />;
  if (status === "degraded") return <AlertTriangle size={15} />;
  if (status === "outage") return <X size={15} />;
  if (status === "maintenance") return <Wrench size={15} />;
  return <CircleHelp size={15} />;
}

function hostStatusLabel(system: BeszelSystem) {
  if (system.status === "up") return "Online";
  if (system.status === "down") return "Offline";
  if (system.status === "paused") return "Pausad";
  if (system.status === "pending") return "Väntar på agent";
  return "Okänd";
}

function formatGb(value: number | null) {
  return value === null ? "—" : `${value.toFixed(1)} GB`;
}

function formatMemory(mb: number | null) {
  if (mb === null) return "—";
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.round(mb)} MB`;
}

function formatUptime(seconds: number | null) {
  if (seconds === null || seconds < 0) return "—";
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  return days ? `${days} d ${hours} h` : `${hours} h`;
}

function ResourceMeter({ icon, label, value, detail }: { icon: ReactNode; label: string; value: number | null; detail?: string }) {
  const display = value === null ? "—" : `${value.toFixed(1)}%`;
  return (
    <div className="system-resource">
      <div className="system-resource-heading">
        <span>{icon}{label}</span>
        <strong>{display}</strong>
      </div>
      <div className="system-resource-track" aria-hidden="true">
        {value !== null && <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />}
      </div>
      {detail && <small>{detail}</small>}
    </div>
  );
}

function storedPreferences(value: unknown): DashboardPreferences | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (!Array.isArray(source.visibleSystemIds) || !source.visibleSystemIds.every((id) => typeof id === "string")) return null;
  const visibleSystemIds = source.visibleSystemIds;
  const metrics = source.metricsBySystem;
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) return null;
  const metricsBySystem: Record<string, MetricKey[]> = {};
  for (const [id, list] of Object.entries(metrics)) {
    if (Array.isArray(list)) metricsBySystem[id] = list.filter((key): key is MetricKey => allMetrics.some((metric) => metric.key === key));
  }
  const knownSystemIds = Array.isArray(source.knownSystemIds) && source.knownSystemIds.every((id) => typeof id === "string")
    ? Array.from(new Set([...source.knownSystemIds, ...visibleSystemIds, ...Object.keys(metricsBySystem)]))
    : Array.from(new Set([...visibleSystemIds, ...Object.keys(metricsBySystem)]));
  return { knownSystemIds, visibleSystemIds, metricsBySystem };
}

function BeszelSystemCard({
  system,
  metrics,
  onOpen,
}: {
  system: BeszelSystem;
  metrics: MetricKey[];
  onOpen: () => void;
}) {
  const runningContainers = system.containers.filter((container) => container.status.toLowerCase() === "running").length;
  return (
    <button className="widget system-group beszel-system" type="button" onClick={onOpen} aria-label={`Visa mer information om ${system.name}`}>
      <div className="widget-heading">
        <h2><Server size={17} /> {system.name}</h2>
        <span className={`beszel-host-status${system.status === "up" ? " is-online" : " is-offline"}`}>
          <span />{hostStatusLabel(system)}
        </span>
      </div>
      <div className="beszel-host-meta">
        <span>{system.host || "Värdnamn saknas"}</span>
        {metrics.includes("uptime") && <span>Drifttid {formatUptime(system.uptimeSeconds)}</span>}
        {system.sampledAt && <span>Mätt {new Date(system.sampledAt).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}</span>}
      </div>
      <div className="beszel-resources">
        {metrics.includes("cpu") && <ResourceMeter icon={<Cpu size={14} />} label="CPU" value={system.cpuPercent} />}
        {metrics.includes("memory") && (
          <ResourceMeter
            icon={<MemoryStick size={14} />}
            label="Minne"
            value={system.memoryPercent}
            detail={system.memoryUsedGb !== null && system.memoryTotalGb !== null ? `${formatGb(system.memoryUsedGb)} av ${formatGb(system.memoryTotalGb)}` : undefined}
          />
        )}
        {metrics.includes("disk") && (
          <ResourceMeter
            icon={<HardDrive size={14} />}
            label="Disk"
            value={system.diskPercent}
            detail={system.diskUsedGb !== null && system.diskTotalGb !== null ? `${formatGb(system.diskUsedGb)} av ${formatGb(system.diskTotalGb)}` : undefined}
          />
        )}
      </div>
      {metrics.includes("containers") && (
        <>
          <div className="beszel-containers-heading">
            <h3><Container size={15} /> Containrar</h3>
            <span>{runningContainers} av {system.containers.length} kör</span>
          </div>
          <div className="system-service-list">
            {system.containers.map((container) => {
              const running = container.status.toLowerCase() === "running";
              return (
                <div className="system-service beszel-container" key={container.name}>
                  <span className={`system-status ${running ? "system-status-operational" : "system-status-outage"}`} aria-label={running ? "Kör" : container.status}>
                    {running ? <Check size={14} /> : <X size={14} />}
                  </span>
                  <div className="system-service-copy">
                    <strong>{container.name}</strong>
                    <small>{container.image || container.status}</small>
                  </div>
                  <span className="beszel-container-usage">
                    {container.cpuPercent === null ? "—" : `${container.cpuPercent.toFixed(1)}% CPU`}
                    <small>{formatMemory(container.memoryMb)} RAM</small>
                  </span>
                </div>
              );
            })}
            {!system.containers.length && <p className="muted">Inga containrar rapporterade för det här systemet.</p>}
          </div>
        </>
      )}
      <span className="beszel-card-hint"><ChartNoAxesCombined size={14} /> Klicka för historik och mer information</span>
    </button>
  );
}

function HistoryTooltip({ active, payload, label, memoryUnit = "percent" }: { active?: boolean; payload?: { name?: string; value?: number; color?: string }[]; label?: string; memoryUnit?: "percent" | "mb" }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="beszel-chart-tooltip">
      <strong>{label}</strong>
      {payload.map((item) => (
        <span key={item.name} style={{ color: item.color }}>{item.name}: {typeof item.value === "number" ? item.name === "Minne" && memoryUnit === "mb" ? formatMemory(item.value) : `${item.value.toFixed(1)}%` : "—"}</span>
      ))}
    </div>
  );
}

function DetailDialog({
  system,
  range,
  onRangeChange,
  onClose,
}: {
  system: BeszelSystem | null;
  range: BeszelHistoryRange;
  onRangeChange: (range: BeszelHistoryRange) => void;
  onClose: () => void;
}) {
  const [history, setHistory] = useState<{ points: BeszelHistoryPoint[]; containerPoints: BeszelContainerHistoryPoint[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [containerName, setContainerName] = useState("");

  useEffect(() => {
    if (!system) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ systemId: system.id, range });
        const response = await fetch(`/api/system/history?${params}`, { cache: "no-store", signal: controller.signal });
        const result: unknown = await response.json();
        if (!response.ok) {
          const message = result && typeof result === "object" && "error" in result && typeof result.error === "string"
            ? result.error
            : "Historiken kunde inte hämtas.";
          throw new Error(message);
        }
        if (!result || typeof result !== "object" || !("points" in result) || !Array.isArray(result.points) || !("containerPoints" in result) || !Array.isArray(result.containerPoints)) {
          throw new Error("Beszel returnerade historik i ett ogiltigt format.");
        }
        setHistory({
          points: result.points as BeszelHistoryPoint[],
          containerPoints: result.containerPoints as BeszelContainerHistoryPoint[],
        });
      } catch (cause) {
        if (cause instanceof Error && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Historiken kunde inte hämtas.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [range, system]);

  const chartData = useMemo(() => (history?.points ?? []).map((point) => ({
    ...point,
    label: new Date(point.timestamp).toLocaleString("sv-SE", range === "7d"
      ? { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }
      : { hour: "2-digit", minute: "2-digit" }),
  })), [history, range]);
  const selectedContainer = containerName || system?.containers[0]?.name || "";
  const containerChartData = useMemo(() => (history?.containerPoints ?? []).flatMap((point) => {
    const container = point.containers.find((item) => item.name === selectedContainer);
    return container ? [{
      label: new Date(point.timestamp).toLocaleString("sv-SE", range === "7d"
        ? { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }
        : { hour: "2-digit", minute: "2-digit" }),
      cpuPercent: container.cpuPercent,
      memoryMb: container.memoryMb,
    }] : [];
  }), [history, range, selectedContainer]);

  return (
    <Dialog open={Boolean(system)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="system-detail-dialog">
        {system && (
          <>
            <DialogHeader>
              <DialogTitle className="system-detail-title"><Server size={18} /> {system.name}</DialogTitle>
              <DialogDescription>{system.host} · {hostStatusLabel(system)} · Drifttid {formatUptime(system.uptimeSeconds)}</DialogDescription>
            </DialogHeader>
            <div className="system-detail-current">
              <div><Cpu size={15} /><span>CPU</span><strong>{system.cpuPercent === null ? "—" : `${system.cpuPercent.toFixed(1)}%`}</strong></div>
              <div><MemoryStick size={15} /><span>Minne</span><strong>{system.memoryPercent === null ? "—" : `${system.memoryPercent.toFixed(1)}%`}</strong><small>{formatGb(system.memoryUsedGb)} / {formatGb(system.memoryTotalGb)}</small></div>
              <div><HardDrive size={15} /><span>Disk</span><strong>{system.diskPercent === null ? "—" : `${system.diskPercent.toFixed(1)}%`}</strong><small>{formatGb(system.diskUsedGb)} / {formatGb(system.diskTotalGb)}</small></div>
            </div>
            <div className="system-history-heading">
              <h3><ChartNoAxesCombined size={16} /> Historisk användning</h3>
              <select aria-label="Välj historikperiod" value={range} onChange={(event) => onRangeChange(event.target.value as BeszelHistoryRange)}>
                {rangeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            {loading ? (
              <div className="system-history-state"><LoaderCircle className="ai-spinner" size={18} /> Hämtar historik…</div>
            ) : error ? (
              <div className="system-history-error" role="alert"><AlertTriangle size={16} />{error}</div>
            ) : chartData.length ? (
              <div className="system-history-chart">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <LineChart data={chartData} margin={{ top: 8, right: 12, bottom: 5, left: -15 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis dataKey="label" minTickGap={42} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
                    <YAxis domain={[0, 100]} width={42} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickFormatter={(value: number) => `${value}%`} />
                    <Tooltip content={<HistoryTooltip />} />
                    <Legend />
                    <Line name="CPU" dataKey="cpuPercent" stroke={metricColors.cpuPercent} dot={false} connectNulls />
                    <Line name="Minne" dataKey="memoryPercent" stroke={metricColors.memoryPercent} dot={false} connectNulls />
                    <Line name="Disk" dataKey="diskPercent" stroke={metricColors.diskPercent} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="system-history-state">Ingen historik finns för den valda perioden ännu.</div>
            )}
            {system.containers.length > 0 && (
              <>
                <div className="system-history-heading system-container-history-heading">
                  <h3><Container size={16} /> Containerhistorik</h3>
                  <select aria-label="Välj container" value={containerName || system.containers[0].name} onChange={(event) => setContainerName(event.target.value)}>
                    {system.containers.map((container) => <option key={container.name} value={container.name}>{container.name}</option>)}
                  </select>
                </div>
                <ContainerHistoryChart data={containerChartData} />
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ContainerHistoryChart({ data }: { data: { label: string; cpuPercent: number | null; memoryMb: number | null }[] }) {
  if (!data.length) return <div className="system-history-state">Ingen containerhistorik finns för den valda perioden.</div>;
  return (
    <div className="system-history-chart system-container-chart">
      <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 5, left: -15 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="label" minTickGap={42} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} />
          <YAxis yAxisId="left" width={42} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickFormatter={(value: number) => `${value}%`} />
          <YAxis yAxisId="right" orientation="right" width={54} tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} tickFormatter={(value: number) => formatMemory(value)} />
          <Tooltip content={<HistoryTooltip memoryUnit="mb" />} />
          <Legend />
          <Line yAxisId="left" name="CPU" dataKey="cpuPercent" stroke={metricColors.cpuPercent} dot={false} connectNulls />
          <Line yAxisId="right" name="Minne" dataKey="memoryMb" stroke={metricColors.memoryPercent} dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SystemDashboard() {
  const [status, setStatus] = useState<DashboardStatus | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [preferences, setPreferences] = useState<DashboardPreferences | null>(null);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedSystem, setSelectedSystem] = useState<BeszelSystem | null>(null);
  const [historyRange, setHistoryRange] = useState<BeszelHistoryRange>("24h");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(preferenceKey);
        if (saved) setPreferences(storedPreferences(JSON.parse(saved)));
      } catch {
        setPreferences(null);
      } finally {
        setPreferencesLoaded(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const refresh = useCallback(async (signal?: AbortSignal, showIndicator = false) => {
    if (showIndicator) setRefreshing(true);
    try {
      const response = await fetch("/api/system/status", { cache: "no-store", signal });
      const result: unknown = await response.json();
      if (response.ok && result && typeof result === "object" && "configured" in result && result.configured === false) {
        setConfigured(false);
        setError("");
        return;
      }
      if (!response.ok) {
        const message = result && typeof result === "object" && "error" in result && typeof result.error === "string"
          ? result.error
          : "Systemstatus kunde inte hämtas.";
        throw new Error(message);
      }
      setConfigured(true);
      setStatus(result as DashboardStatus);
      setError("");
    } catch (cause) {
      if (cause instanceof Error && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Systemstatus kunde inte hämtas.");
    } finally {
      setLoading(false);
      if (showIndicator) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const initialRefresh = window.setTimeout(() => void refresh(controller.signal), 0);
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => {
      window.clearTimeout(initialRefresh);
      controller.abort();
      window.clearInterval(timer);
    };
  }, [refresh]);

  const isBeszel = status?.source === "beszel";
  const kumaStatus = status?.source === "uptime-kuma" ? status : null;
  const systems = isBeszel ? status.systems : [];
  const defaultVisibleIds = systems.map((system) => system.id);
  const knownSystemIds = new Set(preferences?.knownSystemIds ?? defaultVisibleIds);
  const visibleSystemIds = preferences
    ? [...preferences.visibleSystemIds, ...defaultVisibleIds.filter((id) => !knownSystemIds.has(id))]
    : defaultVisibleIds;
  const visibleSystems = systems.filter((system) => visibleSystemIds.includes(system.id));
  const metricsFor = (systemId: string) => preferences?.metricsBySystem[systemId] ?? defaultMetrics;
  const serviceCount = kumaStatus?.groups.reduce((total, group) => total + group.services.length, 0) ?? 0;
  const unavailableCount = kumaStatus?.services.filter((service) => service === "outage" || service === "degraded").length ?? 0;
  const unknownCount = kumaStatus?.services.filter((service) => service === "unknown").length ?? 0;
  const maintenanceCount = kumaStatus?.services.filter((service) => service === "maintenance").length ?? 0;
  const offlineSystemCount = isBeszel ? visibleSystems.filter((system) => system.status !== "up").length : 0;
  const containerCount = isBeszel ? visibleSystems.reduce((total, system) => total + system.containers.length, 0) : 0;
  const runningContainerCount = isBeszel ? visibleSystems.reduce((total, system) => total + system.containers.filter((container) => container.status.toLowerCase() === "running").length, 0) : 0;

  function updatePreferences(update: (current: DashboardPreferences) => DashboardPreferences) {
    const initial: DashboardPreferences = preferences ?? {
      knownSystemIds: defaultVisibleIds,
      visibleSystemIds: defaultVisibleIds,
      metricsBySystem: Object.fromEntries(systems.map((system) => [system.id, defaultMetrics])),
    };
    const current = {
      ...initial,
      knownSystemIds: Array.from(new Set([...initial.knownSystemIds, ...defaultVisibleIds])),
    };
    const next = update(current);
    setPreferences(next);
    try {
      localStorage.setItem(preferenceKey, JSON.stringify(next));
    } catch {
      setError("Systemkortens inställningar kunde inte sparas i webbläsaren.");
    }
  }

  function toggleSystem(systemId: string) {
    updatePreferences((current) => ({
      ...current,
      visibleSystemIds: current.visibleSystemIds.includes(systemId)
        ? current.visibleSystemIds.filter((id) => id !== systemId)
        : [...current.visibleSystemIds, systemId],
    }));
  }

  function toggleMetric(systemId: string, metric: MetricKey) {
    updatePreferences((current) => {
      const currentMetrics = current.metricsBySystem[systemId] ?? defaultMetrics;
      return {
        ...current,
        metricsBySystem: {
          ...current.metricsBySystem,
          [systemId]: currentMetrics.includes(metric)
            ? currentMetrics.filter((value) => value !== metric)
            : [...currentMetrics, metric],
        },
      };
    });
  }

  function closeSettings() {
    setSettingsOpen(false);
    if (preferencesLoaded && !preferences) {
      updatePreferences(() => ({
        knownSystemIds: defaultVisibleIds,
        visibleSystemIds: defaultVisibleIds,
        metricsBySystem: Object.fromEntries(systems.map((system) => [system.id, defaultMetrics])),
      }));
    }
  }

  return (
    <section className="system-dashboard">
      <div className="system-overview-grid">
        <article className="widget system-overview-card">
          <span className="system-overview-icon">{isBeszel ? <Server size={18} /> : <Activity size={18} />}</span>
          <span className="system-overview-label">{isBeszel ? "System" : "Tjänster"}</span>
          <strong>{status ? isBeszel ? visibleSystems.length : serviceCount : "—"}</strong>
          <small>{isBeszel ? "Visas från Beszel" : "Bevakade i Uptime Kuma"}</small>
        </article>
        <article className={`widget system-overview-card${isBeszel ? offlineSystemCount ? " system-overview-warning" : "" : unavailableCount ? " system-overview-warning" : ""}`}>
          <span className="system-overview-icon">{isBeszel ? <Container size={18} /> : unavailableCount ? <AlertTriangle size={18} /> : <Check size={18} />}</span>
          <span className="system-overview-label">{isBeszel ? "Containrar" : "Status"}</span>
          <strong>{status ? isBeszel ? `${runningContainerCount} / ${containerCount} kör` : unavailableCount ? `${unavailableCount} att se över` : unknownCount ? `${unknownCount} okända` : maintenanceCount ? `${maintenanceCount} under underhåll` : "Allt ser bra ut" : "—"}</strong>
          <small>{isBeszel ? `${offlineSystemCount} system ej online` : status ? "Senaste status från Uptime Kuma" : "Väntar på status"}</small>
        </article>
      </div>

      {!configured ? (
        <section className="widget system-empty">
          <Server size={27} />
          <h2>Anslut Beszel</h2>
          <p className="muted">Lägg till <code>BESZEL_URL</code>, <code>BESZEL_EMAIL</code> och <code>BESZEL_PASSWORD</code> som miljövariabler i Coolify. Använd gärna ett separat Beszel-konto med endast läsbehörighet.</p>
          <p className="system-scope-note"><ShieldAlert size={15} /> Beszel-inloggningen används endast på serversidan och skickas aldrig till webbläsaren. Uptime Kuma-statussidan kan fortfarande användas som reserv om Beszel inte är konfigurerat.</p>
        </section>
      ) : error ? (
        <section className="widget system-error" role="alert">
          <AlertTriangle size={20} />
          <div><h2>Status kunde inte hämtas</h2><p>{error}</p></div>
          <button className="secondary small" type="button" onClick={() => void refresh(undefined, true)} disabled={refreshing}><RotateCw size={14} /> Försök igen</button>
        </section>
      ) : loading ? (
        <section className="widget system-loading"><LoaderCircle className="ai-spinner" size={20} /> Hämtar systemstatus…</section>
      ) : (
        <>
          {isBeszel && (
            <div className="system-cards-toolbar">
              <span>{visibleSystems.length} av {systems.length} system visas</span>
              <button className="secondary small" type="button" onClick={() => setSettingsOpen(true)}><Settings2 size={15} /> Anpassa kort</button>
            </div>
          )}
          {isBeszel && visibleSystems.map((system) => (
            <BeszelSystemCard
              key={system.id}
              system={system}
              metrics={metricsFor(system.id)}
              onOpen={() => { setHistoryRange("24h"); setSelectedSystem(system); }}
            />
          ))}
          {isBeszel && !visibleSystems.length && <section className="widget bookmark-empty"><Server size={25} /><h2>Inga system visas</h2><p className="muted">Öppna Anpassa kort för att välja vilka Beszel-system som ska visas.</p></section>}
          {kumaStatus?.incident && (
            <section className="widget system-incident">
              <span><AlertTriangle size={17} /> Pågående incident</span>
              <h2>{kumaStatus.incident.title}</h2>
              <p>{kumaStatus.incident.content}</p>
            </section>
          )}
          {kumaStatus?.groups.map((group) => (
            <section className="widget system-group" key={group.id}>
              <div className="widget-heading">
                <h2><Server size={17} /> {group.name}</h2>
                <span className="system-group-count">{group.services.length} tjänster</span>
              </div>
              <div className="system-service-list">
                {group.services.map((service) => (
                  <article className="system-service" key={service.id}>
                    <span className={`system-status system-status-${service.status}`} aria-label={statusLabel[service.status]}><StatusIcon status={service.status} /></span>
                    <div className="system-service-copy">
                      <strong>{service.name}</strong>
                      <small>
                        {statusLabel[service.status]}
                        {service.uptime24h !== null ? ` · ${service.uptime24h.toFixed(2)}% senaste 24 h` : ""}
                      </small>
                    </div>
                    {service.checkedAt && <span className="system-checked"><Clock3 size={13} />{new Date(service.checkedAt).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}</span>}
                    {service.url.startsWith("https://") && <a className="system-open" href={service.url} target="_blank" rel="noopener noreferrer" aria-label={`Öppna ${service.name}`}><ExternalLink size={15} /></a>}
                  </article>
                ))}
                {!group.services.length && <p className="muted">Inga tjänster i den här gruppen.</p>}
              </div>
            </section>
          ))}
          {kumaStatus && !serviceCount && <section className="widget bookmark-empty"><Server size={25} /><h2>Inga tjänster hittades</h2><p className="muted">Lägg till publika monitorer och grupper på Uptime Kuma-statussidan.</p></section>}
          <footer className="system-updated"><span><Clock3 size={14} /> Uppdaterad {status ? new Date(status.updatedAt).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" }) : "—"} · uppdateras automatiskt varje minut</span><button className="secondary small" type="button" onClick={() => void refresh(undefined, true)} disabled={refreshing}>{refreshing ? <LoaderCircle className="ai-spinner" size={14} /> : <RotateCw size={14} />} Uppdatera</button></footer>
        </>
      )}
      {isBeszel && (
        <>
          <Dialog open={settingsOpen} onOpenChange={(open) => { if (!open) closeSettings(); else setSettingsOpen(true); }}>
            <DialogContent className="system-settings-dialog">
              <DialogHeader>
                <DialogTitle className="system-detail-title"><Settings2 size={18} /> Anpassa statuskort</DialogTitle>
                <DialogDescription>Välj Beszel-system och information att visa på varje kort. Inställningarna sparas lokalt i den här webbläsaren.</DialogDescription>
              </DialogHeader>
              <div className="system-settings-list">
                {systems.map((system) => {
                  const visible = visibleSystemIds.includes(system.id);
                  return (
                    <section className="system-settings-item" key={system.id}>
                      <label className="system-settings-system">
                        <input type="checkbox" checked={visible} onChange={() => toggleSystem(system.id)} />
                        <span><strong>{system.name}</strong><small>{system.host} · {hostStatusLabel(system)}</small></span>
                      </label>
                      <div className="system-settings-metrics">
                        {allMetrics.map((metric) => (
                          <label key={metric.key}>
                            <input type="checkbox" checked={metricsFor(system.id).includes(metric.key)} onChange={() => toggleMetric(system.id, metric.key)} />
                            <span>{metric.label}</span>
                          </label>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            </DialogContent>
          </Dialog>
          <DetailDialog
            system={selectedSystem}
            range={historyRange}
            onRangeChange={setHistoryRange}
            onClose={() => setSelectedSystem(null)}
          />
        </>
      )}
    </section>
  );
}
