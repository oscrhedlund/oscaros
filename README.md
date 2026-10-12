# OscarOS

A private, local-first home screen for one person. Built with React, TypeScript, Tailwind, shadcn/ui, and the Next-compatible Vinext runtime.

## Run

`npm install`

`npm run dev`

`npm run build`

`npm start`

## Coolify

Deployera som **Dockerfile** med projektroten som build context. Containerporten är `3000`. Lägg till `APP_SELF_HOSTED=true` och skydda hela appen med autentisering i Coolify eller en betrodd reverse proxy. AI och Notion är valfria serverhemligheter. Följ [Coolify-guiden](docs/coolify.md) för alla steg och variabler.

## Structure

- `lib/personal-data.ts`: versioned records, bookmarks, demo data, dates, habit statistics, local storage adapter.
- `components/personal-os.tsx`: dashboard, views, editing, capture, command palette, focus timer.
- `components/bookmark-manager.tsx`: locally saved shortcut cards with favicons.
- `components/system-dashboard.tsx`: Beszel host and container metrics, with optional Uptime Kuma service availability fallback.
- `app/globals.css`: shared light/dark tokens and responsive layouts.

Items share stable IDs and a type, title, details, tags, area, timestamps, and optional task/event metadata. Goals link to tasks and notes by ID. Habits store date-based check-ins. Dashboard settings, website shortcut cards, and daily reflections live in the versioned store.

## Notion

Under **Anteckningar** finns anslutning för Notion. Varje vanlig undersida under en vald samlingssida blir en anteckning i appen. Anteckningar kan skapas och ändras från båda apparna; synken körs medan OscarOS är öppet. Integrationsnyckeln ligger på servern i `.dev.vars` lokalt, aldrig i webbläsaren. Se [Notion-inställningen](docs/notion.md).

## Google Kalender

Öppna **Kalender** i menyn och välj **Anslut Google Kalender**. Kopplingen visar poster och låter dig skapa och ändra dem i vald kalender. Smart inmatning visar var posten sparas. Kalendern uppdateras medan appen är öppen; Google-inloggningen kan behöva förnyas. Se [engångsinställning och synkbeteende](docs/google-calendar.md).

## Smart inmatning

Skriv exempelvis ”Fika med Emma imorgon kl 15”, ”Betala elräkningen på fredag” eller ”Anteckning: mina tankar”. Rutan föreslår typ, datum och tid och låter dig ändra tolkningen innan du sparar. Den känner även igen idéer, bokmärken, önskelistor och påminnelser. `#tagg` och `@Livsområde` stöds. Originaltexten behålls i detaljerna.

Tolkningen använder lokala regler för vanliga svenska formuleringar, inte en extern AI-modell. Otydlig text föreslås som en tanke i inkorgen. Kalenderposter kräver datum i snabbformuläret. Påminnelser är sparade poster; inga notifieringar skickas.

## Mulle – din appkompis

Mulle är en chattkompis som kan svara på frågor om OscarOS och använda relevanta uppgifter, anteckningar, kalenderposter, mål, vanor, länkar och reflektioner för personliga svar. Chattmeddelanden och appdata i sammanhanget skickas till OpenAI. Mulle kan förbereda utkast till uppgifter, anteckningar, kalenderposter och påminnelser; de öppnas i appens redigeringsformulär och sparas först efter att du granskat dem. Chatten sparas lokalt i webbläsaren. Den valfria dagsanalysen kan föreslå uppgifter som du själv väljer om du vill lägga till. Se [Mulles integritet och inställning](docs/ai-coach.md) för detaljer om vilka data som skickas.

Konfigurera `OPENAI_API_KEY` och `AI_OWNER_EMAIL` som serverhemligheter i `.dev.vars` lokalt och i publiceringsmiljön. `OPENAI_MODEL` är valfri och använder `gpt-4.1-mini` som standard. API-nyckeln lämnar aldrig servern. Ägarens e-post kontrolleras mot appens inloggningsidentitet på publicerad miljö. Se [Mulles integritet och inställning](docs/ai-coach.md).

## Mobil och hemskärm

Mobilvyn har en fast bottenmeny, snabbsparande, anpassade formulär och stöd för skärmens säkra områden. Ordningen på översiktens kort kan ändras med pilar under Anpassa.

Appen har ett webbmanifest, appikoner och stöd för att startas i ett eget appfönster. Installation på en telefon kräver en åtkomlig HTTPS-adress; datorns `127.0.0.1` fungerar bara på datorn. På iPhone: öppna i Safari och välj Dela → Lägg till på hemskärmen. På Android: välj Installera app eller Lägg till på startskärmen i webbläsarens meny. Anpassa visar installationsknappen när webbläsaren erbjuder den. Offline-start ingår inte.

Data sparas separat i varje webbläsare/enhet. Använd export och återställning av säkerhetskopior för att flytta innehåll.

## Privacy and persistence

Personal entries are stored in this browser's localStorage. No analytics or remote fonts are used. Google Calendar and Notion are optional integrations: connected calendar events and notes are read from and written to their respective services. When you use Mulle, relevant personal data is sent to OpenAI; see [Mulles integritet och inställning](docs/ai-coach.md) for exactly which fields are sent. Notion and AI requests pass through the server to keep integration keys private. Export JSON backups from Customize. Browser storage can be cleared by browser settings, so keep backups. Data is not encrypted at rest; this assumes a trusted personal device/browser profile.

The storage adapter is the boundary for future IndexedDB/SQLite or optional sync. Future integrations should import normalized records through that boundary and request access only when enabled.

## MVP

Home and Today, uncategorized Inbox, tasks with filtered views, markdown notes and backlinks, goals with linked records, habit history, Mulle chat and opt-in daily AI automation, bookmark shortcut cards, Beszel host and container metrics with optional Uptime Kuma service availability, search/actions via Ctrl/Cmd+K, focused task selection and timer, dashboard reorder/hide, editable life areas, light/dark themes, backup export/restore.

Markdown currently supports headings, lists, bold, and internal wiki links; advanced Markdown syntax is outside this MVP. Calendar entries can be managed locally or through Google Calendar, and notes can be managed locally or through Notion. Rich Notion pages are read-only in the app.
