import { env } from "cloudflare:workers";
import { fetchBeszelDashboard } from "@/lib/beszel";
import { fetchSystemStatus } from "@/lib/system-status";

export const dynamic = "force-dynamic";

function configuration() {
  const settings = env as unknown as Record<string, string | undefined>;
  return {
    statusUrl: settings.UPTIME_KUMA_STATUS_URL || "",
    beszelUrl: settings.BESZEL_URL || "",
    beszelEmail: settings.BESZEL_EMAIL || "",
    beszelPassword: settings.BESZEL_PASSWORD || "",
    allowInsecureBeszelHttp: import.meta.env.DEV && settings.BESZEL_ALLOW_INSECURE_HTTP === "true",
    ownerEmail: settings.SYSTEM_STATUS_OWNER_EMAIL || "",
    selfHosted: settings.APP_SELF_HOSTED === "true",
  };
}

function authorized(request: Request, ownerEmail: string, selfHosted: boolean) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  if ((origin && origin !== url.origin) || request.headers.get("Sec-Fetch-Site") === "cross-site") return false;
  if (import.meta.env.DEV && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return true;
  if (selfHosted && !ownerEmail) return request.method === "GET" || Boolean(origin);
  return Boolean(ownerEmail) && request.headers.get("oai-authenticated-user-email")?.toLowerCase() === ownerEmail.toLowerCase();
}

function reply(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  const config = configuration();
  if (!authorized(request, config.ownerEmail, config.selfHosted)) {
    return reply({ error: "Systemstatus kräver en tillåten inloggning och en begäran från appen." }, 403);
  }
  const beszelConfigured = Boolean(config.beszelUrl || config.beszelEmail || config.beszelPassword);
  if (beszelConfigured) {
    if (!config.beszelUrl || !config.beszelEmail || !config.beszelPassword) {
      return reply({ error: "Beszel-kopplingen kräver BESZEL_URL, BESZEL_EMAIL och BESZEL_PASSWORD." }, 503);
    }
    try {
      return reply(await fetchBeszelDashboard(
        config.beszelUrl,
        config.beszelEmail,
        config.beszelPassword,
        fetch,
        config.allowInsecureBeszelHttp,
      ));
    } catch (cause) {
      return reply({
        error: cause instanceof Error ? cause.message : "Systemdata kunde inte hämtas från Beszel.",
      }, 502);
    }
  }
  if (!config.statusUrl) {
    return reply({ configured: false });
  }

  try {
    return reply(await fetchSystemStatus(config.statusUrl));
  } catch (cause) {
    return reply({
      error: cause instanceof Error ? cause.message : "Systemstatus kunde inte hämtas från Uptime Kuma.",
    }, 502);
  }
}
