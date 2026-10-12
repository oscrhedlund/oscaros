import { env } from "cloudflare:workers";
import { getSessionCookie, verifySessionToken } from "@/lib/auth-session";

export type AppAuthConfig = {
  appUrl: string;
  allowedEmail: string;
  secret: string;
  googleClientId: string;
  googleClientSecret: string;
  password: string;
};

export function appAuthConfig(): AppAuthConfig {
  const settings = env as unknown as Record<string, string | undefined>;
  return {
    appUrl: settings.APP_URL || "",
    allowedEmail: (settings.AUTH_ALLOWED_EMAIL || "").trim().toLowerCase(),
    secret: settings.AUTH_SECRET || "",
    googleClientId: settings.GOOGLE_OAUTH_CLIENT_ID || "",
    googleClientSecret: settings.GOOGLE_OAUTH_CLIENT_SECRET || "",
    password: settings.AUTH_PASSWORD || "",
  };
}

function isAllowedAppUrl(value: string) {
  try {
    const url = new URL(value);
    return (
      url.pathname === "/" &&
      !url.search &&
      !url.hash &&
      (url.protocol === "https:" || (import.meta.env.DEV && url.protocol === "http:"))
    );
  } catch {
    return import.meta.env.DEV && value === "";
  }
}

export function authIsConfigured(config = appAuthConfig()) {
  return isAllowedAppUrl(config.appUrl) &&
    Boolean(config.allowedEmail && config.secret.length >= 32 && config.googleClientId && config.googleClientSecret);
}

export function passwordAuthIsConfigured(config = appAuthConfig()) {
  return isAllowedAppUrl(config.appUrl) &&
    Boolean(config.allowedEmail && config.secret.length >= 32 && config.password.length >= 12);
}

export async function requestHasAppSession(request: Request, config = appAuthConfig()) {
  if (!isSameOriginRequest(request, config.appUrl)) return false;
  const isLocalhost = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(request.url).hostname);
  if (import.meta.env.DEV && isLocalhost && !passwordAuthIsConfigured(config) && !authIsConfigured(config)) {
    return true;
  }
  const session = await verifySessionToken(
    getSessionCookie(request.headers),
    config.secret,
    config.allowedEmail,
  );
  return Boolean(session);
}

export async function headersHaveAppSession(headers: Headers, config = appAuthConfig()) {
  const session = await verifySessionToken(
    getSessionCookie(headers),
    config.secret,
    config.allowedEmail,
  );
  return Boolean(session);
}

export function isSameOriginRequest(request: Request, expectedOrigin?: string) {
  const url = new URL(request.url);
  const origin = request.headers.get("Origin");
  const trustedOrigin = expectedOrigin ? new URL(expectedOrigin).origin : url.origin;
  if ((origin && origin !== trustedOrigin) || request.headers.get("Sec-Fetch-Site") === "cross-site") return false;
  return request.method === "GET" || Boolean(origin);
}

export function googleCallbackUrl(config: AppAuthConfig) {
  return `${config.appUrl.replace(/\/+$/, "")}/api/auth/google/callback`;
}
