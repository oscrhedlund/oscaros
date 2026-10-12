# Mulle – din appkompis

Mulle är en svensk chattkompis och guide till Personal OS. Den kan förklara appens funktioner och använda en avgränsad ögonblicksbild av dina lokala appdata för att ge personliga svar. Chattmeddelanden och appdata som ingår i sammanhanget skickas via appservern till OpenAI; API-nyckeln stannar som serverhemlighet.

Vid chatt kan underlaget innehålla uppgifter och deras beskrivningar, anteckningar, kalenderposter, livsområden, taggar, mål, vanor, länkar, fokuspass, reflektioner och inställningar för översiktskort. Högst 60 poster, 30 mål, 30 vanor, 50 länkar och de senaste 14 reflektionerna tas med. De senaste 12 chattmeddelandena skickas som konversationssammanhang. Inloggningsuppgifter och anslutningshemligheter för Google Kalender, Notion och Beszel ingår inte. Beszel-mätvärden hämtas inte in i chatten.

Chattmeddelanden och dagsanalysen sparas i den här webbläsarens lokala lagring och skickas inte till någon serverdatabas. Mulle kan föreslå utkast till uppgifter, anteckningar, kalenderposter och påminnelser. När du väljer ett förslag öppnas appens redigeringsformulär; posten sparas först när du granskat och sparat den där. Mulle kan inte själv starta integrationer. Dagsanalysen kan föreslå högst tre uppgifter; du väljer själv om du vill granska och lägga till dem. Den valfria automatiska dagsanalysen körs högst en gång per dag medan appen är öppen och aktiveras separat. Chatthistoriken kan rensas med papperskorgsknappen.

## Serverinställning

Lägg till följande i `.dev.vars` för lokal utveckling och som motsvarande hemligheter/variabler i publiceringsmiljön:

- `OPENAI_API_KEY`: OpenAI API-nyckel.
- `AI_OWNER_EMAIL`: valfri e-postadress som krävs av ChatGPT-värdar med autentiserad ägaridentitet.
- `OPENAI_MODEL` (valfri): modellnamn. Standard är `gpt-4.1-mini`.

Kopiera variabelnamnen från `.dev.vars.example`. Lagra aldrig API-nyckeln i klientkod, versionshantering eller användarens webbläsare. Lokal utveckling tillåter endast localhost-anrop utan ägaridentitet; alla anrop kontrolleras för ursprung. Endpointen begränsar storlek och frekvens och lagrar inte anropsdata på servern.

Vid självhostning i Coolify ska `APP_SELF_HOSTED=true` sättas och `AI_OWNER_EMAIL` lämnas tom. Skydda då hela appen och dess API:er med autentisering i Coolify eller en betrodd reverse proxy. Se [Coolify-hostning](./coolify.md); same-origin-kontrollen är inte användarinloggning.

AI-leverantörens behandling och lagring av data styrs även av OpenAI-kontots inställningar och villkor. Upplysningen i appen ersätter inte leverantörens integritetsvillkor.
