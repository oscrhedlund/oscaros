export type BeszelState = "up" | "down" | "paused" | "pending" | "unknown";

export type BeszelContainer = {
  name: string;
  image: string;
  status: string;
  cpuPercent: number | null;
  memoryMb: number | null;
};

export type BeszelSystem = {
  id: string;
  name: string;
  host: string;
  status: BeszelState;
  cpuPercent: number | null;
  memoryPercent: number | null;
  memoryUsedGb: number | null;
  memoryTotalGb: number | null;
  diskPercent: number | null;
  diskUsedGb: number | null;
  diskTotalGb: number | null;
  uptimeSeconds: number | null;
  loadAverage: number[] | null;
  sampledAt: string | null;
  containers: BeszelContainer[];
};

export type BeszelDashboard = {
  source: "beszel";
  systems: BeszelSystem[];
  updatedAt: string;
};

export type BeszelHistoryRange = "1h" | "6h" | "24h" | "7d";

export type BeszelHistoryPoint = {
  timestamp: string;
  cpuPercent: number | null;
  memoryPercent: number | null;
  diskPercent: number | null;
};

export type BeszelContainerHistoryPoint = {
  timestamp: string;
  containers: BeszelContainer[];
};

export type BeszelSystemHistory = {
  systemId: string;
  range: BeszelHistoryRange;
  points: BeszelHistoryPoint[];
  containerPoints: BeszelContainerHistoryPoint[];
  updatedAt: string;
};

type RecordValue = Record<string, unknown>;
type Fetcher = typeof fetch;

async function fetchWithoutRedirect(fetcher: Fetcher, input: RequestInfo | URL, init: RequestInit) {
  const response = await fetcher(input, { ...init, redirect: "manual" });
  if (response.status >= 300 && response.status < 400) {
    throw new Error("Beszel skickade en omdirigering. Kontrollera BESZEL_URL så att den pekar direkt på hubben.");
  }
  return response;
}

function object(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null;
}

function text(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function boundedPercent(value: unknown): number | null {
  const percent = finite(value);
  return percent !== null && percent >= 0 && percent <= 100 ? percent : null;
}

function state(value: unknown): BeszelState {
  return value === "up" || value === "down" || value === "paused" || value === "pending"
    ? value
    : "unknown";
}

function baseEndpoint(configuredUrl: string, allowInsecureHttp: boolean) {
  let base: URL;
  try {
    base = new URL(configuredUrl);
  } catch {
    throw new Error("Ange en giltig BESZEL_URL, till exempel https://beszel.example.com.");
  }
  const loopbackHttp = base.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
  if (base.protocol !== "https:" && !loopbackHttp && !(base.protocol === "http:" && allowInsecureHttp)) {
    throw new Error("Beszel-adressen måste använda HTTPS. Endast lokal utveckling kan uttryckligen tillåta oskyddad HTTP.");
  }
  if (base.username || base.password || base.search || base.hash) {
    throw new Error("BESZEL_URL får inte innehålla inloggningsuppgifter, query-parametrar eller fragment.");
  }
  base.pathname = `${base.pathname.replace(/\/+$/, "")}/`;
  return base;
}

function apiUrl(base: URL, path: string, params?: Record<string, string>) {
  const url = new URL(path, base);
  if (params) {
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  }
  return url;
}

async function jsonResponse(response: Response, failureMessage: string): Promise<unknown> {
  if (!response.ok) {
    throw new Error(failureMessage);
  }
  try {
    return await response.json();
  } catch {
    throw new Error("Beszel returnerade ett ogiltigt JSON-svar.");
  }
}

async function authenticate(base: URL, email: string, password: string, fetcher: Fetcher) {
  if (!email.trim() || !password) throw new Error("BESZEL_EMAIL och BESZEL_PASSWORD måste båda vara konfigurerade.");
  const authResponse = await fetchWithoutRedirect(fetcher, apiUrl(base, "api/collections/users/auth-with-password"), {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ identity: email.trim(), password }),
    signal: AbortSignal.timeout(10_000),
  });
  const auth = object(await jsonResponse(authResponse, authResponse.status === 400 || authResponse.status === 401
    ? "Beszel-inloggningen misslyckades. Kontrollera BESZEL_EMAIL och BESZEL_PASSWORD."
    : "Beszel kunde inte autentisera anslutningen. Kontrollera BESZEL_URL och användarkontot."));
  const token = text(auth?.token);
  if (!token) throw new Error("Beszel-inloggningen saknade en åtkomsttoken.");
  return token;
}

async function getCollectionRecords(
  base: URL,
  token: string,
  systemId: string,
  fetcher: Fetcher,
) {
  const url = apiUrl(base, "api/collections/containers/records", {
    filter: `system="${systemId}"`,
    sort: "name",
    perPage: "200",
    fields: "name,image,status,health",
  });
  const response = await fetchWithoutRedirect(fetcher, url, {
    headers: { Accept: "application/json", Authorization: token },
    signal: AbortSignal.timeout(10_000),
  });
  const body = object(await jsonResponse(response, "Beszel kunde inte läsa containrarna. Kontrollera användarens läsbehörighet."));
  if (!body || !Array.isArray(body.items)) throw new Error("Beszel returnerade en ogiltig containerlista.");
  if (typeof body.totalItems === "number" && body.totalItems > 200) {
    throw new Error("Beszel returnerade fler än 200 containrar för ett system. Begränsa antalet för att visa alla här.");
  }
  return body.items.map(object).filter((item): item is RecordValue => item !== null);
}

async function latestForSystem(base: URL, token: string, collection: "system_stats" | "container_stats", systemId: string, fetcher: Fetcher) {
  const url = apiUrl(base, `api/collections/${collection}/records`, {
    filter: `system="${systemId}" && type="1m"`,
    sort: "-created",
    perPage: "1",
    fields: "system,created,stats",
  });
  const response = await fetchWithoutRedirect(fetcher, url, {
    headers: { Accept: "application/json", Authorization: token },
    signal: AbortSignal.timeout(10_000),
  });
  const body = object(await jsonResponse(response, `Beszel kunde inte läsa ${collection}. Kontrollera användarens läsbehörighet.`));
  if (!body || !Array.isArray(body.items)) throw new Error(`Beszel returnerade en ogiltig lista för ${collection}.`);
  return object(body.items[0]);
}

function normalizeSystem(record: RecordValue, systemStats: RecordValue | null, containerStats: RecordValue | null, containerRecords: RecordValue[]): BeszelSystem {
  const id = text(record.id);
  const statusValue = state(record.status);
  const statsRecord = object(systemStats?.stats);
  const info = object(record.info);
  const load = Array.isArray(statsRecord?.la) ? statsRecord.la.map(finite) : null;
  const statsTimestamp = text(systemStats?.created);
  const sampledAt = statsTimestamp && Number.isFinite(Date.parse(statsTimestamp)) ? statsTimestamp : null;
  const containersStats = Array.isArray(containerStats?.stats) ? containerStats.stats : [];
  const containerStatsByName = new Map<string, RecordValue>();
  for (const value of containersStats) {
    const item = object(value);
    if (item && typeof item.n === "string") containerStatsByName.set(item.n, item);
  }
  const knownContainers = containerRecords.map((container) => {
    const name = text(container.name, "Namnlös container").slice(0, 120);
    const stats = containerStatsByName.get(name);
    return {
      name,
      image: text(container.image).slice(0, 180),
      status: text(container.status, "okänd").slice(0, 40),
      cpuPercent: boundedPercent(stats?.c),
      memoryMb: finite(stats?.m),
    };
  });
  const seenNames = new Set(knownContainers.map((container) => container.name));
  for (const [name, stats] of containerStatsByName) {
    if (!seenNames.has(name)) {
      knownContainers.push({
        name: name.slice(0, 120),
        image: "",
        status: "running",
        cpuPercent: boundedPercent(stats.c),
        memoryMb: finite(stats.m),
      });
    }
  }

  return {
    id,
    name: text(record.name, text(info?.h, "Namnlös server")).slice(0, 120),
    host: text(record.host, text(info?.h)).slice(0, 180),
    status: statusValue,
    cpuPercent: boundedPercent(statsRecord?.cpu),
    memoryPercent: boundedPercent(statsRecord?.mp),
    memoryUsedGb: finite(statsRecord?.mu),
    memoryTotalGb: finite(statsRecord?.m),
    diskPercent: boundedPercent(statsRecord?.dp),
    diskUsedGb: finite(statsRecord?.du),
    diskTotalGb: finite(statsRecord?.d),
    uptimeSeconds: finite(info?.u),
    loadAverage: load && load.every((value): value is number => value !== null) ? load : null,
    sampledAt,
    containers: knownContainers,
  };
}

async function mapConcurrent<T, R>(items: T[], concurrency: number, action: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await action(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function fetchBeszelDashboard(
  configuredUrl: string,
  email: string,
  password: string,
  fetcher: Fetcher = fetch,
  allowInsecureHttp = false,
): Promise<BeszelDashboard> {
  const base = baseEndpoint(configuredUrl, allowInsecureHttp);
  const token = await authenticate(base, email, password, fetcher);

  const systemsResponse = await fetchWithoutRedirect(fetcher, apiUrl(base, "api/collections/systems/records", {
    sort: "name",
    perPage: "50",
    fields: "id,name,host,status,info",
  }), {
    headers: { Accept: "application/json", Authorization: token },
    signal: AbortSignal.timeout(10_000),
  });
  const systemsPayload = object(await jsonResponse(systemsResponse, "Beszel kunde inte läsa systemlistan. Kontrollera användarens läsbehörighet."));
  if (!systemsPayload || !Array.isArray(systemsPayload.items)) throw new Error("Beszel returnerade en ogiltig systemlista.");
  const records = systemsPayload.items.map(object).filter((item): item is RecordValue => item !== null);
  if (typeof systemsPayload.totalItems === "number" && systemsPayload.totalItems > 50) {
    throw new Error("Beszel har fler än 50 system. Begränsa anslutningen för att visa alla här.");
  }

  const systems = await mapConcurrent(records, 5, async (system) => {
    const id = text(system.id);
    if (!/^[a-z0-9]{1,64}$/.test(id)) throw new Error("Beszel returnerade ett ogiltigt system-ID.");
    const [systemStats, containerStats, containers] = await Promise.all([
      latestForSystem(base, token, "system_stats", id, fetcher),
      latestForSystem(base, token, "container_stats", id, fetcher),
      getCollectionRecords(base, token, id, fetcher),
    ]);
    return normalizeSystem(system, systemStats, containerStats, containers);
  });

  return { source: "beszel", systems, updatedAt: new Date().toISOString() };
}

function historyTimestamp(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const date = typeof value === "number"
    ? new Date(value < 10_000_000_000 ? value * 1000 : value)
    : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

async function historyRecords(
  base: URL,
  token: string,
  collection: "system_stats" | "container_stats",
  systemId: string,
  range: BeszelHistoryRange,
  start: Date,
  fetcher: Fetcher,
) {
  const type = range === "7d" ? "10m" : "1m";
  const filter = `system="${systemId}" && type="${type}" && created >= "${start.toISOString().replace("T", " ")}"`;
  const results: RecordValue[] = [];
  for (let page = 1; page <= 5; page++) {
    const url = apiUrl(base, `api/collections/${collection}/records`, {
      filter,
      sort: "created",
      perPage: "500",
      page: String(page),
      fields: "system,created,stats",
    });
    const response = await fetchWithoutRedirect(fetcher, url, {
      headers: { Accept: "application/json", Authorization: token },
      signal: AbortSignal.timeout(10_000),
    });
    const body = object(await jsonResponse(response, `Beszel kunde inte läsa historiken för ${collection}. Kontrollera användarens läsbehörighet.`));
    if (!body || !Array.isArray(body.items)) throw new Error(`Beszel returnerade en ogiltig historiklista för ${collection}.`);
    const items = body.items.map(object).filter((item): item is RecordValue => item !== null);
    results.push(...items);
    if (items.length < 500 || results.length >= 2_500) break;
  }
  return results;
}

export async function fetchBeszelSystemHistory(
  configuredUrl: string,
  email: string,
  password: string,
  systemId: string,
  range: BeszelHistoryRange,
  fetcher: Fetcher = fetch,
  allowInsecureHttp = false,
): Promise<BeszelSystemHistory> {
  if (!/^[a-z0-9]{1,64}$/.test(systemId)) throw new Error("Ogiltigt Beszel-system-ID.");
  const base = baseEndpoint(configuredUrl, allowInsecureHttp);
  const token = await authenticate(base, email, password, fetcher);
  const duration: Record<BeszelHistoryRange, number> = {
    "1h": 60 * 60 * 1000,
    "6h": 6 * 60 * 60 * 1000,
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
  };
  const start = new Date(Date.now() - duration[range]);
  const [systemRecords, containerRecords] = await Promise.all([
    historyRecords(base, token, "system_stats", systemId, range, start, fetcher),
    historyRecords(base, token, "container_stats", systemId, range, start, fetcher),
  ]);
  const points = systemRecords.flatMap((record) => {
    const timestamp = historyTimestamp(record.created);
    const stats = object(record.stats);
    return timestamp && stats ? [{
      timestamp,
      cpuPercent: boundedPercent(stats.cpu),
      memoryPercent: boundedPercent(stats.mp),
      diskPercent: boundedPercent(stats.dp),
    }] : [];
  });
  const containerPoints = containerRecords.flatMap((record) => {
    const timestamp = historyTimestamp(record.created);
    if (!timestamp || !Array.isArray(record.stats)) return [];
    const containers = record.stats.flatMap((value) => {
      const container = object(value);
      const name = text(container?.n);
      if (!container || !name) return [];
      return [{
        name: name.slice(0, 120),
        image: "",
        status: "running",
        cpuPercent: boundedPercent(container.c),
        memoryMb: finite(container.m),
      }];
    });
    return [{ timestamp, containers }];
  });
  return {
    systemId,
    range,
    points: points.slice(-2_500),
    containerPoints: containerPoints.slice(-2_500),
    updatedAt: new Date().toISOString(),
  };
}
