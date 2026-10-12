import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchBeszelDashboard, fetchBeszelSystemHistory } from "./beszel";

test("Beszel dashboard authenticates server-side and normalizes host and container metrics", async () => {
  const requests: { url: string; authorization: string | null; body: string | null }[] = [];
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    assert.equal(init?.redirect, "manual");
    requests.push({
      url: url.href,
      authorization: new Headers(init?.headers).get("Authorization"),
      body: typeof init?.body === "string" ? init.body : null,
    });
    if (url.pathname.endsWith("/auth-with-password")) return Response.json({ token: "server-only-token" });
    if (url.pathname.endsWith("/systems/records")) {
      return Response.json({
        items: [{ id: "system123456789", name: "Home server", host: "192.168.1.20", status: "up", info: { u: 86_400 } }],
      });
    }
    if (url.pathname.endsWith("/system_stats/records")) {
      return Response.json({
        items: [{
          created: "2026-10-12 18:00:00.000Z",
          stats: { cpu: 22.4, mp: 51.2, mu: 4.1, m: 8, dp: 63, du: 126, d: 200, la: [0.2, 0.3, 0.4] },
        }],
      });
    }
    if (url.pathname.endsWith("/container_stats/records")) {
      return Response.json({ items: [{ stats: [{ n: "web", c: 1.2, m: 512 }, { n: "db", c: 4.8, m: 1536 }] }] });
    }
    if (url.pathname.endsWith("/containers/records")) {
      return Response.json({
        items: [{ name: "web", image: "nginx:latest", status: "running" }, { name: "db", image: "postgres:16", status: "running" }],
      });
    }
    return new Response(null, { status: 404 });
  }) as typeof fetch;

  const result = await fetchBeszelDashboard("https://beszel.example.com/", "readonly@example.com", "private-password", fetcher);
  assert.equal(result.source, "beszel");
  assert.equal(result.systems[0].name, "Home server");
  assert.equal(result.systems[0].cpuPercent, 22.4);
  assert.equal(result.systems[0].memoryUsedGb, 4.1);
  assert.equal(result.systems[0].uptimeSeconds, 86_400);
  assert.equal(result.systems[0].containers[1].name, "db");
  assert.equal(result.systems[0].containers[1].memoryMb, 1536);
  assert.equal(requests[0].authorization, null);
  assert.deepEqual(JSON.parse(requests[0].body || "{}"), {
    identity: "readonly@example.com",
    password: "private-password",
  });
  assert.ok(requests.slice(1).every((request) => request.authorization === "server-only-token"));
  assert.ok(requests.every((request) => !request.url.includes("private-password")));
});

test("Beszel rejects non-HTTPS URLs and URLs with embedded credentials or query values", async () => {
  await assert.rejects(fetchBeszelDashboard("http://beszel.example.com", "user", "password"), /HTTPS/);
  await assert.rejects(fetchBeszelDashboard("https://user:password@beszel.example.com", "user", "password"), /inloggningsuppgifter/);
  await assert.rejects(fetchBeszelDashboard("https://beszel.example.com/?token=secret", "user", "password"), /query-parametrar/);
});

test("Beszel remote HTTP requires explicit opt-in", async () => {
  await assert.rejects(
    fetchBeszelDashboard("http://beszel.example.com", "user", "password"),
    /måste använda HTTPS/,
  );
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    assert.equal(url.protocol, "http:");
    if (url.pathname.endsWith("/auth-with-password")) return Response.json({ token: "server-only-token" });
    if (url.pathname.endsWith("/systems/records")) return Response.json({ items: [] });
    return new Response(null, { status: 404 });
  }) as typeof fetch;
  const result = await fetchBeszelDashboard("http://beszel.example.com", "user", "password", fetcher, true);
  assert.equal(result.source, "beszel");
});

test("Beszel remote HTTP opt-in does not permit insecure endpoints in production route configuration", async () => {
  await assert.rejects(
    fetchBeszelDashboard("http://beszel.example.com", "user", "password", fetch, false),
    /måste använda HTTPS/,
  );
});

test("Beszel reports authentication failures without returning remote response content", async () => {
  const fetcher = (async () => Response.json({ message: "private server details" }, { status: 401 })) as typeof fetch;
  await assert.rejects(
    fetchBeszelDashboard("https://beszel.example.com", "wrong@example.com", "wrong", fetcher),
    (error: unknown) => error instanceof Error && /inloggningen misslyckades/.test(error.message) && !error.message.includes("private server details"),
  );
});

test("Beszel rejects redirects without forwarding credentials", async () => {
  const fetcher = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(init?.redirect, "manual");
    return new Response(null, { status: 302, headers: { Location: "https://other.example.com/" } });
  }) as typeof fetch;
  await assert.rejects(
    fetchBeszelDashboard("https://beszel.example.com", "readonly@example.com", "private-password", fetcher),
    /omdirigering/,
  );
});

test("Beszel requires the complete server-side connection configuration", async () => {
  await assert.rejects(
    fetchBeszelDashboard("https://beszel.example.com", "", "password"),
    /BESZEL_EMAIL och BESZEL_PASSWORD/,
  );
});

test("Beszel history fetches bounded system and container points for the selected time range", async () => {
  const requests: URL[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    requests.push(url);
    if (url.pathname.endsWith("/auth-with-password")) return Response.json({ token: "history-token" });
    if (url.pathname.endsWith("/system_stats/records")) {
      return Response.json({
        items: [{
          created: "2026-10-12 19:00:00.000Z",
          stats: { cpu: 17.5, mp: 48.2, dp: 61.3 },
        }],
      });
    }
    if (url.pathname.endsWith("/container_stats/records")) {
      return Response.json({
        items: [{
          created: "2026-10-12 19:00:00.000Z",
          stats: [{ n: "web", c: 2.5, m: 512 }],
        }],
      });
    }
    return new Response(null, { status: 404 });
  }) as typeof fetch;

  const result = await fetchBeszelSystemHistory(
    "http://beszel.example.com",
    "readonly@example.com",
    "private-password",
    "system123456789",
    "7d",
    fetcher,
    true,
  );
  assert.equal(result.range, "7d");
  assert.equal(result.points.length, 1);
  assert.equal(result.points[0].cpuPercent, 17.5);
  assert.equal(result.points[0].memoryPercent, 48.2);
  assert.equal(result.containerPoints[0].containers[0].name, "web");
  assert.equal(result.containerPoints[0].containers[0].memoryMb, 512);
  const statsQueries = requests.filter((url) => url.pathname.endsWith("_stats/records"));
  assert.equal(statsQueries.length, 2);
  assert.ok(statsQueries.every((url) => url.searchParams.get("filter")?.includes('type="10m"')));
  assert.ok(statsQueries.every((url) => url.searchParams.get("filter")?.includes('created >=')));
  assert.ok(statsQueries.every((url) => url.searchParams.get("perPage") === "500"));
});
