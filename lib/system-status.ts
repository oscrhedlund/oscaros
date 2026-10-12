export type ServiceStatus = "operational" | "degraded" | "outage" | "maintenance" | "unknown";

export type SystemStatus = {
  source: "uptime-kuma";
  groups: {
    id: string;
    name: string;
    services: {
      id: string;
      name: string;
      url: string;
      status: ServiceStatus;
      uptime24h: number | null;
      checkedAt: string | null;
    }[];
  }[];
  services: ServiceStatus[];
  incident: { title: string; content: string } | null;
  updatedAt: string;
};

type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null;
}

function string(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function identifier(value: unknown, fallback: string) {
  return typeof value === "string" && value || typeof value === "number" && Number.isFinite(value)
    ? String(value)
    : fallback;
}

function percent(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const normalized = value <= 1 ? value * 100 : value;
  return normalized >= 0 && normalized <= 100 ? normalized : null;
}

function monitorStatus(value: unknown): ServiceStatus {
  if (value === 1 || value === "up") return "operational";
  if (value === 0 || value === "down") return "outage";
  if (value === 3 || value === "maintenance") return "maintenance";
  if (value === 2 || value === "pending") return "unknown";
  return "unknown";
}

function pageEndpoint(configuredUrl: string, endpoint: "status" | "heartbeat") {
  const page = new URL(configuredUrl);
  if (page.protocol !== "https:" && !(page.protocol === "http:" && ["localhost", "127.0.0.1"].includes(page.hostname))) {
    throw new Error("Uptime Kuma-statussidan måste använda HTTPS.");
  }
  if (page.username || page.password || page.search || page.hash) {
    throw new Error("Statuslänken får inte innehålla inloggningsuppgifter, query-parametrar eller fragment.");
  }
  const match = page.pathname.match(/^(.*)\/status\/([a-zA-Z0-9_-]+)\/?$/);
  if (!match) throw new Error("Ange en publik Uptime Kuma-länk i formatet https://status.example.com/status/slug.");
  page.pathname = `${match[1]}/api/status-page/${endpoint === "heartbeat" ? `heartbeat/${match[2]}` : match[2]}`;
  return page;
}

function safeServiceUrl(value: unknown) {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

export async function fetchSystemStatus(configuredUrl: string, fetcher: typeof fetch = fetch): Promise<SystemStatus> {
  let statusUrl: URL;
  let heartbeatUrl: URL;
  try {
    statusUrl = pageEndpoint(configuredUrl, "status");
    heartbeatUrl = pageEndpoint(configuredUrl, "heartbeat");
  } catch (cause) {
    throw new Error(cause instanceof Error ? cause.message : "Uptime Kuma-länken är ogiltig.");
  }

  const [statusResponse, heartbeatResponse] = await Promise.all([
    fetcher(statusUrl, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000), redirect: "error" }),
    fetcher(heartbeatUrl, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000), redirect: "error" }),
  ]);
  if (!statusResponse.ok || !heartbeatResponse.ok) {
    if (statusResponse.status === 404 || heartbeatResponse.status === 404) {
      throw new Error("Uptime Kuma hittade inte statussidan. Kontrollera status-URL:en och att sidan är publik.");
    }
    throw new Error("Uptime Kuma kunde inte lämna statusdata. Kontrollera att den publika statussidan är aktiverad.");
  }

  let page: RecordValue | null;
  let heartbeat: RecordValue | null;
  try {
    [page, heartbeat] = await Promise.all([statusResponse.json(), heartbeatResponse.json()])
      .then(([pageData, heartbeatData]) => [record(pageData), record(heartbeatData)]);
  } catch {
    throw new Error("Uptime Kuma returnerade statusdata i ett ogiltigt format.");
  }
  if (!page || !heartbeat || !Array.isArray(page.publicGroupList)) {
    throw new Error("Uptime Kuma-svaret saknar publika statusgrupper. Kontrollera statuslänken.");
  }

  const heartbeatList = record(heartbeat.heartbeatList) || {};
  const uptimeList = record(heartbeat.uptimeList) || {};
  const groups = page.publicGroupList.map((value, groupIndex) => {
    const group = record(value) || {};
    const services = (Array.isArray(group.monitorList) ? group.monitorList : []).map((monitorValue, monitorIndex) => {
      const monitor = record(monitorValue) || {};
      const id = identifier(monitor.id, `${groupIndex}-${monitorIndex}`);
      const history = heartbeatList[id];
      const latest = Array.isArray(history) ? record(history[history.length - 1]) : null;
      const uptime = record(uptimeList[id]);
      const serviceStatus = monitorStatus(latest?.status ?? monitor.status);
      const rawUptime = uptime?.["24"] ?? uptime?.["24h"] ?? uptime?.["1"];
      const checked = string(latest?.time);
      return {
        id,
        name: string(monitor.name, "Namnlös tjänst").slice(0, 120),
        url: safeServiceUrl(monitor.url),
        status: serviceStatus,
        uptime24h: percent(rawUptime),
        checkedAt: checked && Number.isFinite(Date.parse(checked)) ? checked : null,
      };
    });
    return {
      id: identifier(group.id, `group-${groupIndex}`),
      name: string(group.name, "Tjänster").slice(0, 120),
      services,
    };
  });
  const incidentData = record(page.incident);
  const incident = incidentData && string(incidentData.title).trim()
    ? {
        title: string(incidentData.title).slice(0, 160),
        content: string(incidentData.content).slice(0, 1200),
      }
    : null;

  return {
    source: "uptime-kuma",
    groups,
    services: groups.flatMap((group) => group.services.map((service) => service.status)),
    incident,
    updatedAt: new Date().toISOString(),
  };
}
