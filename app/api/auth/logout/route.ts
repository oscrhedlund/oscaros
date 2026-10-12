import { appAuthConfig, isSameOriginRequest } from "@/lib/app-auth";
import { appSessionCookie } from "@/lib/auth-session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const config = appAuthConfig();
  if (!isSameOriginRequest(request, config.appUrl || undefined)) {
    return Response.json({ error: "Utloggningen måste komma från appen." }, { status: 403 });
  }
  const secure = config.appUrl.startsWith("https://");
  return new Response(null, {
    status: 303,
    headers: {
      Location: new URL("/login", config.appUrl || new URL(request.url).origin).toString(),
      "Cache-Control": "no-store",
      "Set-Cookie": `${appSessionCookie.name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? "; Secure" : ""}`,
    },
  });
}
