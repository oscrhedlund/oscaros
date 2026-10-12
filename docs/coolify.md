# Hostning med Coolify

Projektet kan distribueras som en Docker-applikation. Coolify bygger den med den inkluderade `Dockerfile` och startar servern på `0.0.0.0:3000`.

## Distribuera

1. Lägg projektet i ett privat Git-repo som Coolify kan läsa, eller anslut Coolify till den aktuella repokällan.
2. Skapa en **Application** i Coolify från Git-källan och välj byggmetoden **Dockerfile**. Ange `Dockerfile` som sökväg och projektets rotkatalog som build context.
3. Ange domän och slå på HTTPS/TLS i Coolify. Containerporten är `3000`; appen lyssnar på alla containergränssnitt.
4. Lägg till följande miljövariabel:

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

   Markera lösenord och API-nycklar som hemliga i Coolify. Skapa gärna en separat Beszel-användare med läsbehörighet och dela endast de system som ska visas. Beszel-inloggningen skickas bara från appservern till Beszel och exponeras aldrig i webbläsaren. Använd inte `AI_OWNER_EMAIL` eller `NOTION_OWNER_EMAIL` i vanligt självhostat läge: Coolify skickar normalt inte appplattformens `oai-authenticated-user-email`-identitet. Lämna dessa variabler tomma/utelämnade. Appen accepterar då endast same-origin-begäranden, och servernycklarna stannar på serversidan.

5. Spara inställningarna och distribuera. Docker-containern kör som den obehöriga `node`-användaren och har en inbyggd hälsokontroll.

System-dashboarden använder Beszel när `BESZEL_URL`, `BESZEL_EMAIL` och `BESZEL_PASSWORD` är konfigurerade. Den visar serverstatus, CPU, minne, disk, drifttid och containerstatus/-användning. Med **Anpassa kort** kan du välja vilka system och mätvärden som visas; valen sparas lokalt i webbläsaren. Klicka på ett systemkort för grafer över serverhistorik och, när containrar finns, containerhistorik. Historiken kan filtreras till 1 timme, 6 timmar, 24 timmar eller 7 dagar. Appservern måste kunna nå Beszel-hubben. HTTPS krävs för hubbadressen, förutom localhost i lokal utveckling. Om Beszel-variablerna inte anges kan `UPTIME_KUMA_STATUS_URL` fortfarande användas för tjänststatus och incidenter; den publika Kuma-statussidan visar inte CPU/RAM/disk.

För lokal utveckling kan `BESZEL_ALLOW_INSECURE_HTTP=true` användas tillsammans med en `http://`-adress om Beszel saknar ett betrott HTTPS-certifikat. Detta är endast aktivt i utvecklingsservern och ignoreras i produktion. HTTP skickar Beszel-inloggningen okrypterad över nätverket; använd helst en lokal SSH-tunnel eller aktivera HTTPS innan anslutning över internet.

Om du ansluter Notion ska integrationen ha läs-, skapande- och redigeringsbehörighet till den valda sidan. För Google Kalender behöver klientens exakta HTTPS-ursprung läggas till bland OAuth-klientens tillåtna JavaScript-ursprung; OAuth-klient-ID:t anges sedan i appens kalenderinställning.

## Skydda den personliga appen

Appen har ingen egen inloggningssida. `APP_SELF_HOSTED=true` ersätter inte användarautentisering; det gör det möjligt för den självhostade installationen att använda Notion och AI utan ChatGPT-identitetsheaders. Skydda därför **hela applikationen, inklusive `/api/*`**, med Coolifys/proxyns åtkomstskydd, exempelvis autentisering via en säker reverse-proxy eller identity provider. Använd HTTPS och exponera aldrig en oskyddad instans publikt. Origin-kontrollen på API:erna är CSRF-skydd, inte inloggning.

Coolify använder normalt samma serverhemligheter för alla som får åtkomst till installationen. När du använder Mulle skickas frågan, chattkontexten och relevanta appposter till OpenAI. Skydda därför appen med autentisering och läs [AI-integritetsdokumentationen](./ai-coach.md) innan du aktiverar `OPENAI_API_KEY`.

## Data och säkerhetskopior

Uppgifter, anteckningar, mål, vanor och länkkort lagras lokalt i respektive webbläsares `localStorage`, inte i containern. En omstart eller omdistribution raderar därför normalt inte webbläsarens data, men data synkas inte mellan enheter och rensas om användaren rensar sin webbläsardata. Exportera säkerhetskopior från appen och förvara dem separat. Ingen servervolym behövs för personliga poster.

Serverhemligheter injiceras av Coolify vid containerstart i en tillfällig Wrangler-konfigurationsfil med begränsade filrättigheter. Startskriptet tar bort filen vid normal avstängning; den ignoreras av Git och Docker-build context. Wrangler skapar även lokal runtime-state i containern, men den innehåller inte appens personliga poster.

För lokal start utan Docker används fortfarande `npm run dev` eller `npm run build` följt av `npm start`.
