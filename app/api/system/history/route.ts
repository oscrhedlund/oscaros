import { env } from "cloudflare:workers";
import { fetchBeszelSystemHistory, type BeszelHistoryRange } from "@/lib/beszel";
import { requestHasAppSession } from "@/lib/app-auth";

export const dynamic = "force-dynamic";

const ranges = new Set<BeszelHistoryRange>(["1h", "6h", "24h", "7d"]);

function reply(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const settings = env as unknown as Record<string, string | undefined>;
  if (!await requestHasAppSession(request)) {
    return reply({ error: "Systemhistorik kräver en tillåten inloggning och en begäran från appen." }, 403);
  }
  const url = new URL(request.url);
  const systemId = url.searchParams.get("systemId") || "";
  const range = url.searchParams.get("range") || "24h";
  if (!ranges.has(range as BeszelHistoryRange)) {
    return reply({ error: "Välj ett historikintervall på 1 h, 6 h, 24 h eller 7 dagar." }, 400);
  }
  const beszelUrl = settings.BESZEL_URL || "";
  const beszelEmail = settings.BESZEL_EMAIL || "";
  const beszelPassword = settings.BESZEL_PASSWORD || "";
  if (!beszelUrl || !beszelEmail || !beszelPassword) {
    return reply({ error: "Beszel är inte konfigurerat för systemhistorik." }, 503);
  }
  try {
    return reply(await fetchBeszelSystemHistory(
      beszelUrl,
      beszelEmail,
      beszelPassword,
      systemId,
      range as BeszelHistoryRange,
      fetch,
      import.meta.env.DEV && settings.BESZEL_ALLOW_INSECURE_HTTP === "true",
    ));
  } catch (cause) {
    return reply({
      error: cause instanceof Error ? cause.message : "Historik kunde inte hämtas från Beszel.",
    }, 502);
  }
}
