# Google Kalender

Appen ansluter direkt till Google med Google Identity Services och Calendar API. Ingen klienthemlighet eller refresh-token används. OAuth-åtkomsttoken hålls enbart i minnet. Inloggningen kan behöva förnyas efter ungefär en timme eller efter att appen stängts. Synken körs när appen är öppen, varje minut och när fönstret återfår fokus.

## Engångsinställning

1. Skapa eller välj ett projekt i [Google Cloud Console](https://console.cloud.google.com/).
2. Aktivera Google Calendar API under API:er och tjänster.
3. Konfigurera Google Auth Platform: appnamn, kontaktuppgifter och målgrupp. Vid testning lägger du till ditt Google-konto som testanvändare.
4. Skapa en OAuth-klient av typen **Webbapplikation**. Under **Tillåtna JavaScript-ursprung** anger du `http://127.0.0.1:5173` för lokal preview och appens exakta HTTPS-ursprung för telefonen/publicerad version. Om du använder `http://localhost:5173` måste även det anges. Ange ursprung utan sökväg eller avslutande snedstreck.
5. Klistra in klient-ID:t, som slutar med `.apps.googleusercontent.com`, i appens Google-inställning. Ingen klienthemlighet behövs.
6. Klicka **Anslut Google Kalender**, välj konto och godkänn åtkomst. Välj sedan kalender.

Scopes: `calendar.events` för läsning och ändring av händelser, samt `calendar.calendarlist.readonly` för val av kalender. En publik app kan behöva Googles verifiering. [Google Identity Services](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [Calendar-behörigheter](https://developers.google.com/workspace/calendar/api/auth).

## Beteende

- Nya kalenderposter kan sparas lokalt eller i vald Google-kalender. Destinationen visas före sparande.
- Start, slut, tidszon, plats och beskrivning kan ändras. Kalenderns tidszon används som standard.
- Google-ändringar skickas först; vid fel förblir formuläret öppet. Ingen lokal framgång rapporteras innan Google svarar.
- Ändringar använder ETag/If-Match. Om posten ändrats på annat håll ber appen dig uppdatera och öppna den igen.
- Återkommande poster ändras endast för den valda förekomsten. Gäster, upprepningsregler och andra Google-fält skrivs inte över.
- Importerade poster i läskalendrar och möten där du inte är organisatör visas som skrivskyddade.
- Synkfönstret är 30 dagar bakåt och ett år framåt. Alla sidor inom fönstret hämtas.
- Koppla från tar bort importerade poster ur den aktuella vyn. Det återkallar inte Googles kontobehörighet; detta kan göras under ditt Google-kontos anslutna appar.
- Radering av Google-poster ingår inte. Lokala anteckningar och uppgifter förblir lokala. Påminnelser i appen skapar inga Google-notifieringar.
- Kalenderkopplingen synkar inte appens övriga data mellan telefon och dator.
