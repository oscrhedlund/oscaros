# Hostning med Coolify

Projektet kan distribueras som en Docker-applikation. Coolify bygger den med den inkluderade `Dockerfile` och startar servern på `0.0.0.0:3000`.

## Distribuera

1. Lägg projektet i ett privat Git-repo som Coolify kan läsa, eller anslut Coolify till den aktuella repokällan.
2. Skapa en **Application** i Coolify från Git-källan och välj byggmetoden **Dockerfile**. Ange `Dockerfile` som sökväg och projektets rotkatalog som build context.
3. Ange domän och slå på HTTPS/TLS i Coolify. Containerporten är `3000`; appen lyssnar på alla containergränssnitt.
4. Lägg till inloggningsvariablerna. Google-inloggningen låser appen till ett enda Google-konto och sätter en signerad, `HttpOnly`-cookie som gäller i 30 dagar.

   Skapa först en **OAuth client ID** av typen **Web application** i Google Cloud Console. Lägg till `https://DIN-DOMÄN/api/auth/google/callback` som *Authorized redirect URI*. Konfigurera OAuth consent screen och lägg till ägarens Google-konto som testanvändare om appen står i testläge. Kopiera klient-ID och klienthemlighet till Coolify.

   | Namn | Värde | Krävs |
   |---|---|---|
   | `APP_URL` | Appens publika HTTPS-adress utan avslutande snedstreck, t.ex. `https://personal.example.com` | Ja |
   | `AUTH_ALLOWED_EMAIL` | Exakt e-postadress för det enda Google-konto som får logga in | Ja |
   | `AUTH_SECRET` | Slumpmässig hemlighet på minst 32 tecken; skapa t.ex. med `openssl rand -base64 48` eller PowerShell: `[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))` | Ja |
   | `GOOGLE_OAUTH_CLIENT_ID` | Google Cloud OAuth Web application client ID | Ja |
   | `GOOGLE_OAUTH_CLIENT_SECRET` | Hemligheten till OAuth-klienten | Ja |
   | `AUTH_PASSWORD` | Ett starkt tillfälligt lösenord på minst 12 tecken; använd som reserv tills Google OAuth är konfigurerat | Valfri |

   Google redirect URI måste vara exakt `https://DIN-DOMÄN/api/auth/google/callback`. Använd HTTPS i Coolify; `Secure`-inloggningscookien skickas inte över vanlig HTTP. Använd OAuth-klienten endast för OscarOS-inloggningen. Kalenderns befintliga klient-ID är en separat inställning. Om OAuth-klienten inte är konfigurerad visas i stället ett e-post/lösenordsformulär med `AUTH_ALLOWED_EMAIL` och `AUTH_PASSWORD`. När Google OAuth är komplett används Google-inloggning och lösenordsinloggningen stängs automatiskt av.

5. Lägg till övriga funktionsvariabler efter behov:

   | Namn | Värde | Krävs |
   |---|---|---|
   | `APP_SELF_HOSTED` | `true` | Ja |
   | `OPENAI_API_KEY` | Din OpenAI API-nyckel | Endast för Mulle |
   | `OPENAI_MODEL` | `gpt-4.1-mini` | Nej |
   | `NOTION_API_KEY` | Notion-integrationens nyckel | Endast för Notion |
   | `NOTION_PARENT_PAGE_ID` | ID eller länk till Notion-samlingen | Endast för Notion |
   | `BESZEL_URL` | Beszel-hubbens HTTPS-adress, t.ex. `https://beszel.example.com` | För Beszel-systemvyn |
   | `BESZEL_EMAIL` | E-post till ett separat Beszel-konto med läsbehörighet | För Beszel-systemvyn |
   | `BESZEL_PASSWORD` | Lösenord för Beszel-kontot | För Beszel-systemvyn |
   | `UPTIME_KUMA_STATUS_URL` | Publik länk, t.ex. `https://status.example.com/status/home` | Valfri reserv om Beszel inte är konfigurerat |

   Markera `AUTH_PASSWORD`, lösenord, API-nycklar, `AUTH_SECRET` och `GOOGLE_OAUTH_CLIENT_SECRET` som hemliga i Coolify. Skapa gärna en separat Beszel-användare med läsbehörighet och dela endast de system som ska visas. Beszel-inloggningen skickas bara från appservern till Beszel och exponeras aldrig i webbläsaren. `AI_OWNER_EMAIL` och `NOTION_OWNER_EMAIL` används inte för appinloggningen.

6. Spara inställningarna och distribuera. Docker-containern kör som den obehöriga `node`-användaren och har en inbyggd hälsokontroll. Om Google OAuth är konfigurerat väljer du **Fortsätt med Google**; annars loggar du in med e-postadressen i `AUTH_ALLOWED_EMAIL` och det tillfälliga `AUTH_PASSWORD`. Andra Google-konton nekas även om de lyckas autentisera hos Google. **Logga ut** raderar sessionscookien från den aktuella enheten.

System-dashboarden använder Beszel när `BESZEL_URL`, `BESZEL_EMAIL` och `BESZEL_PASSWORD` är konfigurerade. Den visar serverstatus, CPU, minne, disk, drifttid och containerstatus/-användning. Med **Anpassa kort** kan du välja vilka system och mätvärden som visas; valen sparas lokalt i webbläsaren. Klicka på ett systemkort för grafer över serverhistorik och, när containrar finns, containerhistorik. Historiken kan filtreras till 1 timme, 6 timmar, 24 timmar eller 7 dagar. Appservern måste kunna nå Beszel-hubben. HTTPS krävs för hubbadressen, förutom localhost i lokal utveckling. Om Beszel-variablerna inte anges kan `UPTIME_KUMA_STATUS_URL` fortfarande användas för tjänststatus och incidenter; den publika Kuma-statussidan visar inte CPU/RAM/disk.

För lokal utveckling kan `BESZEL_ALLOW_INSECURE_HTTP=true` användas tillsammans med en `http://`-adress om Beszel saknar ett betrott HTTPS-certifikat. Detta är endast aktivt i utvecklingsservern och ignoreras i produktion. HTTP skickar Beszel-inloggningen okrypterad över nätverket; använd helst en lokal SSH-tunnel eller aktivera HTTPS innan anslutning över internet.

Om du ansluter Notion ska integrationen ha läs-, skapande- och redigeringsbehörighet till den valda sidan. För Google Kalender behöver klientens exakta HTTPS-ursprung läggas till bland OAuth-klientens tillåtna JavaScript-ursprung; OAuth-klient-ID:t anges sedan i appens kalenderinställning.

## Appinloggning och skydd

Appen skyddar startsidan och privata API:er med Google OAuth-inloggning. Inloggningen använder Authorization Code + PKCE; ID-tokenens signatur verifieras mot Googles publika nycklar, och e-postadressen måste vara verifierad och matcha `AUTH_ALLOWED_EMAIL`. En serververifierad, signerad `HttpOnly`, `SameSite=Lax`-cookie håller dig inloggad i 30 dagar; utloggning raderar cookien. Innan Google OAuth är komplett kan du i stället ange `AUTH_PASSWORD` och logga in med `AUTH_ALLOWED_EMAIL` som e-postadress. När Google OAuth-konfigurationen blir komplett stängs lösenordsinloggningen av. I lokal utveckling aktiveras lösenordsinloggningen först när `AUTH_ALLOWED_EMAIL`, `AUTH_SECRET` och `AUTH_PASSWORD` har satts i `.dev.vars`; starta om dev-servern efter ändringen. Distribuerad inloggning kräver HTTPS. Låt `APP_SELF_HOSTED=true` vara satt för självhostade AI-/Notion-funktioner; det är inte längre den mekanism som skyddar åtkomsten.

Använd fortfarande HTTPS i Coolify och exponera inte serverhemligheter. API:erna kontrollerar också ursprung för att motverka CSRF, men den kontrollen ersätter inte inloggningen. Lokal utveckling på localhost fortsätter att fungera utan Google OAuth.

Coolify använder normalt samma serverhemligheter för alla som får åtkomst till installationen. När du använder Mulle skickas frågan, chattkontexten och relevanta appposter till OpenAI. Skydda därför appen med autentisering och läs [AI-integritetsdokumentationen](./ai-coach.md) innan du aktiverar `OPENAI_API_KEY`.

## Data och säkerhetskopior

Uppgifter, anteckningar, mål, vanor och länkkort lagras lokalt i respektive webbläsares `localStorage`, inte i containern. En omstart eller omdistribution raderar därför normalt inte webbläsarens data, men data synkas inte mellan enheter och rensas om användaren rensar sin webbläsardata. Exportera säkerhetskopior från appen och förvara dem separat. Ingen servervolym behövs för personliga poster.

Serverhemligheter injiceras av Coolify vid containerstart i en tillfällig Wrangler-konfigurationsfil med begränsade filrättigheter. Startskriptet tar bort filen vid normal avstängning; den ignoreras av Git och Docker-build context. Wrangler skapar även lokal runtime-state i containern, men den innehåller inte appens personliga poster.

För lokal start utan Docker används fortfarande `npm run dev` eller `npm run build` följt av `npm start`.
