# Notion-anteckningar

1. Skapa en Notion-sida, exempelvis **Oscar OS – Anteckningar**. Vanliga undersidor blir anteckningar i appen.
2. Skapa en intern integration på https://www.notion.so/profile/integrations. Välj rätt workspace och aktivera läsning, skapande och uppdatering av innehåll.
3. Öppna den valda sidan i Notion. Under sidans meny väljer du **Connections / Anslutningar** och lägger till integrationen. Dela endast den samling du vill synka.
4. Kopiera `.dev.vars.example` till `.dev.vars` i projektet. Fyll i `NOTION_API_KEY` med integrationsnyckeln och `NOTION_PARENT_PAGE_ID` med sidans länk eller ID. Nyckeln ska aldrig skickas i chatten.
5. Starta om liveförhandsvisningen och öppna **Anteckningar → Anslut Notion**.

Nyckeln används på servern och skickas inte till webbläsaren. Vid publicering ska värdena läggas i serverns miljöinställningar. `NOTION_OWNER_EMAIL` måste då matcha appägarens autentiserade ChatGPT-konto; andra besökare nekas Notion-åtkomst.

Appen hämtar vanliga undersidor till den valda sidan och uppdaterar dem medan den är öppen. Databaser, djupare undermappar och avancerade sidor med bilagor eller undersidor synkas inte som redigerbara textanteckningar. En anteckning med sådant innehåll öppnas i Notion för redigering. Radering i Notion gör att posten försvinner ur nästa synk; appen raderar inte Notion-poster.

Nya anteckningar kan sparas lokalt eller i Notion. Befintliga lokala anteckningar flyttas bara när du väljer Notion och sparar. Konflikter som upptäcks före sparande stoppar uppdateringen. Notion erbjuder ingen atomisk If-Match för hela detta flöde; samtidig redigering i exakt samma ögonblick kan fortfarande ge en konflikt. Titel och innehåll uppdateras med separata anrop; vid ett delvis misslyckat sparande, uppdatera innan du försöker igen.

[Notions Markdown-API](https://developers.notion.com/guides/data-apis/working-with-markdown-content)
