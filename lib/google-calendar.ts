import type {Item} from './personal-data';
export const GOOGLE_SCOPES='https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly';
export type GoogleCalendar={id:string;summary:string;timeZone?:string;accessRole:string;primary?:boolean};
export type GoogleEvent={id:string;etag?:string;summary?:string;description?:string;location?:string;status?:string;locked?:boolean;recurringEventId?:string;organizer?:{self?:boolean};start:{date?:string;dateTime?:string;timeZone?:string};end:{date?:string;dateTime?:string;timeZone?:string};htmlLink?:string};
export function nextDate(date:string,days=1){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
const validDate=(v:string)=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T12:00:00Z'))&&new Date(v+'T12:00:00Z').toISOString().slice(0,10)===v;
export function eventTime(item:Item){return item.startTime??(/^([0-2]\d:[0-5]\d)\s*·/.exec(item.body)?.[1]||'')}
export function defaultEnd(date:string,time:string){const d=new Date(`${date}T${time}:00Z`);d.setUTCHours(d.getUTCHours()+1);return {endDate:d.toISOString().slice(0,10),endTime:d.toISOString().slice(11,16)}}
export function googlePayload(item:Item,calendarZone='Europe/Stockholm'){
 if(!item.title.trim())throw Error('Skriv en titel.');
 if(!validDate(item.due))throw Error('Välj ett giltigt startdatum.');
 const time=eventTime(item),zone=item.timeZone||calendarZone;
 try{new Intl.DateTimeFormat('sv-SE',{timeZone:zone}).format()}catch{throw Error('Tidszonen är inte giltig.')}
 const description=item.google?item.body:item.body.replace(/^(?:\d{2}:\d{2}|Hela dagen)\s*·\s*/u,'');
 if(!time){const end=item.endDate||item.due;if(!validDate(end)||end<item.due)throw Error('Slutdatum måste vara samma dag eller senare.');return {summary:item.title.trim(),description,location:item.location||'',start:{date:item.due},end:{date:nextDate(end)}}}
 if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))throw Error('Välj en giltig starttid.');
 const fallback=defaultEnd(item.due,time),endDate=item.endDate||fallback.endDate,endTime=item.endTime||fallback.endTime;
 if(!validDate(endDate)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime)||`${endDate}T${endTime}`<=`${item.due}T${time}`)throw Error('Sluttiden måste vara efter starttiden.');
 return {summary:item.title.trim(),description,location:item.location||'',start:{dateTime:`${item.due}T${time}:00`,timeZone:zone},end:{dateTime:`${endDate}T${endTime}:00`,timeZone:zone}};
}
function wallTime(value:string,zone:string){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(value));const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`}}
export function fromGoogleEvent(event:GoogleEvent,calendar:GoogleCalendar):Item{
 const zone=event.start.timeZone||calendar.timeZone||'Europe/Stockholm';
 const start=event.start.date?{date:event.start.date,time:''}:wallTime(event.start.dateTime!,zone);
 const end=event.end.date?{date:nextDate(event.end.date,-1),time:''}:wallTime(event.end.dateTime!,zone);
 return {id:`google:${calendar.id}:${event.id}`,kind:'event',title:event.summary||'Utan titel',body:event.description||'',location:event.location||'',due:start.date,startTime:start.time,endDate:end.date,endTime:end.time,timeZone:zone,area:'',tags:'',priority:'Normal',project:'',done:false,focus:false,pinned:false,created:new Date().toISOString(),google:{calendarId:calendar.id,eventId:event.id,etag:event.etag,readOnly:!['owner','writer'].includes(calendar.accessRole)||Boolean(event.locked)||event.organizer?.self===false,recurring:Boolean(event.recurringEventId),url:event.htmlLink}};
}
export async function calendarRequest<T>(token:string,path:string,init:RequestInit={},fetcher:typeof fetch=fetch):Promise<T>{
 const headers=new Headers(init.headers);headers.set('Authorization',`Bearer ${token}`);if(init.body)headers.set('Content-Type','application/json');
 const response=await fetcher(`https://www.googleapis.com/calendar/v3/${path}`,{...init,headers});
 if(!response.ok){
  const payload=await response.json().catch(()=>null) as {error?:{status?:string;errors?:{reason?:string}[];details?:{reason?:string}[]}}|null;
  const reasons=[...(payload?.error?.errors||[]),...(payload?.error?.details||[])].map(x=>x.reason);
  if(reasons.some(r=>['accessNotConfigured','SERVICE_DISABLED','API_DISABLED'].includes(r||'')))throw Error('Google Calendar API är inte aktiverat för ditt Google Cloud-projekt. Aktivera API:t och anslut sedan igen.');
  if(reasons.some(r=>['insufficientPermissions','ACCESS_TOKEN_SCOPE_INSUFFICIENT'].includes(r||'')))throw Error('Google gav inte appen alla kalenderbehörigheter. Koppla från och anslut igen och godkänn både kalenderlistan och kalenderposter.');
  if(reasons.includes('forbiddenForNonOrganizer'))throw Error('Denna ändring kräver att du är mötets organisatör.');
  if(response.status===429||reasons.some(r=>['rateLimitExceeded','userRateLimitExceeded','quotaExceeded'].includes(r||'')))throw Error('Googles anropsgräns är nådd. Försök igen om en stund.');
  if(response.status===401)throw Error('Google-inloggningen har gått ut. Anslut igen.');
  if(response.status===412)throw Error('Posten har ändrats i Google Kalender. Uppdatera kalendern och öppna posten igen.');
  if(response.status===403){const writing=init.method&&init.method!=='GET';throw Error(writing?'Du saknar rättighet att ändra denna kalender eller post. Välj en kalender där du får ändra händelser.':'Google nekade åtkomst när kalendern skulle hämtas. Kontrollera att Google Calendar API är aktiverat och att kalenderåtkomst har godkänts.');}
  if(response.status===404)throw Error('Posten finns inte längre. Uppdatera kalendern.');
  throw Error('Google Kalender kunde inte svara. Försök igen.');
 }
 return await response.json() as T;
}
