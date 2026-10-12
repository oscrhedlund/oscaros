import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  appAuthConfig,
  authIsConfigured,
  headersHaveAppSession,
  passwordAuthIsConfigured,
} from "@/lib/app-auth";

export const dynamic = "force-dynamic";

const errors: Record<string, string> = {
  setup: "Inloggningen behöver konfigureras på servern innan du kan fortsätta.",
  state: "Inloggningen kunde inte verifieras. Försök igen.",
  cancelled: "Google-inloggningen avbröts.",
  token: "Google-inloggningen misslyckades. Försök igen.",
  forbidden: "Det här Google-kontot har inte åtkomst till appen.",
  credentials: "E-postadressen eller lösenordet stämmer inte.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") || "";
  const localDevelopment = import.meta.env.DEV && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
  const config = appAuthConfig();
  const googleConfigured = authIsConfigured(config);
  const passwordConfigured = passwordAuthIsConfigured(config);
  if (
    (localDevelopment && !googleConfigured && !passwordConfigured) ||
    await headersHaveAppSession(requestHeaders, config)
  ) redirect("/");
  const { error } = await searchParams;

  return (
    <main className="login-page">
      <section className="login-card">
        <span className="login-mark" aria-hidden="true" />
        <p className="login-eyebrow">OSCAROS</p>
        <h1>Välkommen hem.</h1>
        <p className="login-description">
          {googleConfigured
            ? "Logga in med det Google-konto som har tillgång till OscarOS."
            : passwordConfigured
              ? "Logga in med din e-postadress och ditt lösenord."
              : "Inloggningen behöver konfigureras på servern innan du kan fortsätta."}
        </p>
        {error && <p className="login-error" role="alert">{errors[error] || errors.token}</p>}
        {googleConfigured ? (
          <a className="google-login" href="/api/auth/google">
            <svg viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.73 7.18l7.72 5.99c4.51-4.17 7.05-10.3 7.05-17.64Z" />
              <path fill="#FBBC05" d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z" />
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.81l-7.72-5.99c-2.14 1.44-4.89 2.3-8.19 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
            </svg>
            Fortsätt med Google
          </a>
        ) : passwordConfigured ? (
          <form className="password-login" action="/api/auth/password" method="post">
            <label htmlFor="login-email">E-postadress</label>
            <input id="login-email" name="email" type="email" autoComplete="username" required maxLength={320} />
            <label htmlFor="login-password">Lösenord</label>
            <input id="login-password" name="password" type="password" autoComplete="current-password" required maxLength={1024} />
            <button className="google-login" type="submit">Logga in</button>
          </form>
        ) : (
          <p className="login-error" role="status">
            Lägg till AUTH_ALLOWED_EMAIL, AUTH_PASSWORD och AUTH_SECRET på servern.
          </p>
        )}
        <p className="login-footnote">
          Endast ditt konto har åtkomst. Du förblir inloggad på den här enheten i 30 dagar.
        </p>
      </section>
    </main>
  );
}
