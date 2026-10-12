import { appAuthConfig, authIsConfigured, googleCallbackUrl } from "@/lib/app-auth";
import { createSessionToken, readCookie, safeEqual, appSessionCookie } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

type GoogleClaims = {
  iss?: string;
  aud?: string | string[];
  azp?: string;
  iat?: number;
  exp?: number;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
};

function cookie(name: string, value: string, options: { secure: boolean; maxAge: number; path?: string }) {
  return `${name}=${encodeURIComponent(value)}; Path=${options.path || "/"}; HttpOnly; SameSite=Lax; Max-Age=${options.maxAge}${options.secure ? "; Secure" : ""}`;
}

function decodeBase64UrlJson<T>(part: string): T {
  const normalized = part.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

async function verifyGoogleIdToken(idToken: string, clientId: string, allowedEmail: string) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Google returnerade en ogiltig identitetstoken.");
  const header = decodeBase64UrlJson<{ alg?: string; kid?: string }>(parts[0]);
  if (header.alg !== "RS256" || !header.kid) throw new Error("Googles signaturformat stöds inte.");

  const keysResponse = await fetch("https://www.googleapis.com/oauth2/v3/certs", {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!keysResponse.ok) throw new Error("Googles signeringsnycklar kunde inte hämtas.");
  const keys = await keysResponse.json() as { keys?: (JsonWebKey & { kid?: string })[] };
  const jwk = keys.keys?.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error("Googles token använde en okänd signeringsnyckel.");

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signedBytes = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = Uint8Array.from(
    atob(parts[2].replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(parts[2].length / 4) * 4, "=")),
    (character) => character.charCodeAt(0),
  );
  if (!await crypto.subtle.verify("RSASSA-PKCS1-v1_5", publicKey, signature, signedBytes)) {
    throw new Error("Googles identitetstoken hade en ogiltig signatur.");
  }

  const claims = decodeBase64UrlJson<GoogleClaims>(parts[1]);
  const audienceMatches = Array.isArray(claims.aud) ? claims.aud.includes(clientId) : claims.aud === clientId;
  const now = Math.floor(Date.now() / 1000);
  if (
    !["accounts.google.com", "https://accounts.google.com"].includes(claims.iss || "") ||
    !audienceMatches ||
    (Array.isArray(claims.aud) && claims.aud.length > 1 && claims.azp !== clientId) ||
    typeof claims.exp !== "number" ||
    claims.exp <= now ||
    typeof claims.iat !== "number" ||
    claims.iat > now + 60 ||
    now - claims.iat > 3600 ||
    typeof claims.email !== "string" ||
    claims.email.toLowerCase() !== allowedEmail.toLowerCase() ||
    !(claims.email_verified === true || claims.email_verified === "true")
  ) throw new Error("Google-kontot är inte tillåtet för den här appen.");
  return { email: claims.email, name: claims.name || claims.email };
}

export async function GET(request: Request) {
  const config = appAuthConfig();
  if (!authIsConfigured(config)) {
    return new Response(null, { status: 303, headers: { Location: "/login?error=setup", "Cache-Control": "no-store" } });
  }
  const url = new URL(request.url);
  const secure = config.appUrl.startsWith("https://");
  const clearFlowCookies = [
    cookie("personal_os_oauth_state", "", { secure, maxAge: 0, path: "/api/auth/google" }),
    cookie("personal_os_oauth_verifier", "", { secure, maxAge: 0, path: "/api/auth/google" }),
  ];
  const fail = (reason: string, status = 303) => {
    const headers = new Headers({
      Location: new URL(`/login?error=${encodeURIComponent(reason)}`, config.appUrl).toString(),
      "Cache-Control": "no-store",
    });
    for (const value of clearFlowCookies) headers.append("Set-Cookie", value);
    return new Response(null, { status, headers });
  };

  const state = url.searchParams.get("state");
  const expectedState = readCookie(request.headers, "personal_os_oauth_state");
  const verifier = readCookie(request.headers, "personal_os_oauth_verifier");
  if (!state || !expectedState || !safeEqual(state, expectedState) || !verifier) return fail("state");
  if (url.searchParams.has("error")) return fail("cancelled");
  const code = url.searchParams.get("code");
  if (!code || code.length > 4096) return fail("token");

  let tokenResponse: Response;
  try {
    tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.googleClientId,
        client_secret: config.googleClientSecret,
        redirect_uri: googleCallbackUrl(config),
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    return fail("token");
  }
  if (!tokenResponse.ok) return fail("token");
  let tokenData: { id_token?: string };
  try {
    tokenData = await tokenResponse.json() as { id_token?: string };
  } catch {
    return fail("token");
  }
  if (!tokenData.id_token) return fail("token");

  try {
    const user = await verifyGoogleIdToken(tokenData.id_token, config.googleClientId, config.allowedEmail);
    const sessionToken = await createSessionToken(user.email, user.name, config.secret);
    const headers = new Headers({
      Location: new URL("/", config.appUrl).toString(),
      "Cache-Control": "no-store",
    });
    for (const value of clearFlowCookies) headers.append("Set-Cookie", value);
    headers.append("Set-Cookie", cookie(appSessionCookie.name, sessionToken, { secure, maxAge: appSessionCookie.maxAge }));
    return new Response(null, {
      status: 303,
      headers,
    });
  } catch (error) {
    const reason = error instanceof Error && error.message.includes("Google-kontot") ? "forbidden" : "token";
    return fail(reason);
  }
}
