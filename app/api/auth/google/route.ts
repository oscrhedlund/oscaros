import { appAuthConfig, authIsConfigured, googleCallbackUrl } from "@/lib/app-auth";

export const dynamic = "force-dynamic";

function randomToken(byteLength: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function cookie(name: string, value: string, secure: boolean) {
  return `${name}=${encodeURIComponent(value)}; Path=/api/auth/google; HttpOnly; SameSite=Lax; Max-Age=600${secure ? "; Secure" : ""}`;
}

export async function GET() {
  const config = appAuthConfig();
  if (!authIsConfigured(config)) {
    return new Response(null, { status: 303, headers: { Location: "/login?error=setup", "Cache-Control": "no-store" } });
  }
  const state = randomToken(32);
  const verifier = randomToken(48);
  const challenge = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challengeBase64 = btoa(String.fromCharCode(...new Uint8Array(challenge)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  const secure = config.appUrl.startsWith("https://");
  const authorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizeUrl.search = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: googleCallbackUrl(config),
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challengeBase64,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  const headers = new Headers({
    Location: authorizeUrl.toString(),
    "Cache-Control": "no-store",
  });
  headers.append("Set-Cookie", cookie("personal_os_oauth_state", state, secure));
  headers.append("Set-Cookie", cookie("personal_os_oauth_verifier", verifier, secure));
  return new Response(null, {
    status: 302,
    headers,
  });
}
