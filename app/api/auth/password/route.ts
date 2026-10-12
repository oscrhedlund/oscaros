import { appAuthConfig, authIsConfigured, isSameOriginRequest, passwordAuthIsConfigured } from "@/lib/app-auth";
import { appSessionCookie, createSessionToken, safeEqual } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

function redirectToLogin(error: string, cookie?: string) {
  const headers = new Headers({
    Location: `/login?error=${encodeURIComponent(error)}`,
    "Cache-Control": "no-store",
  });
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}

export async function POST(request: Request) {
  const config = appAuthConfig();
  if (authIsConfigured(config)) {
    return Response.json({ error: "Använd Google-inloggningen." }, { status: 404 });
  }
  if (!passwordAuthIsConfigured(config)) return redirectToLogin("setup");
  if (!isSameOriginRequest(request, config.appUrl || undefined)) {
    return Response.json({ error: "Inloggningen måste komma från appen." }, { status: 403 });
  }
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > 4096) return redirectToLogin("credentials");
  if (!request.headers.get("Content-Type")?.startsWith("application/x-www-form-urlencoded")) {
    return redirectToLogin("credentials");
  }
  const reader = request.body?.getReader();
  if (!reader) return redirectToLogin("credentials");
  const chunks: Uint8Array[] = [];
  let bodyLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    bodyLength += value.byteLength;
    if (bodyLength > 4096) {
      await reader.cancel();
      return redirectToLogin("credentials");
    }
    chunks.push(value);
  }
  const body = new Uint8Array(bodyLength);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const form = new URLSearchParams(new TextDecoder().decode(body));
  const email = form.get("email");
  const password = form.get("password");
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    email.length > 320 ||
    password.length > 1024 ||
    !safeEqual(email.trim().toLowerCase(), config.allowedEmail) ||
    !safeEqual(password, config.password)
  ) {
    return redirectToLogin("credentials");
  }

  const token = await createSessionToken(config.allowedEmail, config.allowedEmail, config.secret);
  const secure = config.appUrl.startsWith("https://");
  return new Response(null, {
    status: 303,
    headers: {
      Location: "/",
      "Cache-Control": "no-store",
      "Set-Cookie": `${appSessionCookie.name}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${appSessionCookie.maxAge}${secure ? "; Secure" : ""}`,
    },
  });
}
