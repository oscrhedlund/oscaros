import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchSystemStatus } from "./system-status";
import { storeSchema } from "./store-schema";

test("Uptime Kuma status page is normalized into grouped service status", async () => {
  const requests: string[] = [];
  const fetcher = (async (input: RequestInfo | URL) => {
    const url = String(input);
    requests.push(url);
    if (url.endsWith("/api/status-page/home")) {
      return Response.json({
        publicGroupList: [{
          id: 2,
          name: "Homelab",
          monitorList: [
            { id: 10, name: "Coolify", url: "https://panel.example.com", status: 1 },
            { id: 11, name: "NAS", url: "http://192.168.1.10", status: 0 },
          ],
        }],
        incident: { title: "Disk check", content: "Investigating" },
      });
    }
    return Response.json({
      heartbeatList: {
        10: [{ status: 1, time: "2026-10-12T10:00:00.000Z" }],
        11: [{ status: 0, time: "2026-10-12T10:01:00.000Z" }],
      },
      uptimeList: { 10: { "24": 0.998 } },
    });
  }) as typeof fetch;

  const result = await fetchSystemStatus("https://status.example.com/status/home", fetcher);
  assert.deepEqual(requests.sort(), [
    "https://status.example.com/api/status-page/heartbeat/home",
    "https://status.example.com/api/status-page/home",
  ]);
  assert.equal(result.groups[0].name, "Homelab");
  assert.equal(result.groups[0].services[0].status, "operational");
  assert.equal(result.groups[0].services[0].uptime24h, 99.8);
  assert.equal(result.groups[0].services[1].status, "outage");
  assert.equal(result.groups[0].services[1].url, "");
  assert.equal(result.incident?.title, "Disk check");
});

test("Status page URL must use the public status-page format over HTTPS", async () => {
  await assert.rejects(
    fetchSystemStatus("https://status.example.com/api/status-page/home"),
    /formatet https/,
  );
  await assert.rejects(
    fetchSystemStatus("http://status.example.com/status/home"),
    /HTTPS/,
  );
  await assert.rejects(
    fetchSystemStatus("https://user:password@status.example.com/status/home"),
    /inloggningsuppgifter/,
  );
});

test("Non-successful Uptime Kuma responses surface a useful connection error", async () => {
  const fetcher = (async () => new Response(null, { status: 404 })) as typeof fetch;
  await assert.rejects(
    fetchSystemStatus("https://status.example.com/status/missing", fetcher),
    /Kontrollera status-URL:en/,
  );
});

test("Old local backups load with an empty links collection", () => {
  const migrated = storeSchema.parse({
    version: 1, items: [], goals: [], habits: [], areas: [], widgets: [],
    hidden: [], dark: true, sessions: 0, reflections: {},
  });
  assert.deepEqual(migrated.bookmarks, []);
});
