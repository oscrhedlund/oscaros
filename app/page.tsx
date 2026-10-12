import { headers } from "next/headers";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/logout-button";
import PersonalOS from "@/components/personal-os";
import { appAuthConfig, authIsConfigured, headersHaveAppSession, passwordAuthIsConfigured } from "@/lib/app-auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") || "";
  const localDevelopment = import.meta.env.DEV && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
  const config = appAuthConfig();
  const authConfigured = authIsConfigured(config) || passwordAuthIsConfigured(config);
  if ((!localDevelopment || authConfigured) && !await headersHaveAppSession(requestHeaders, config)) redirect("/login");
  return <><PersonalOS />{(!localDevelopment || authConfigured) && <LogoutButton />}</>;
}
