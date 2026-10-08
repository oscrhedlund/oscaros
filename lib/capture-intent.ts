import type {Kind} from './personal-data';

export type CaptureIntent={kind:Kind;title:string;body:string;due:string;time:string;priority:string;area:string;tags:string;warnings:string[]};
const weekdays=['söndag','måndag','tisdag','onsdag','torsdag','fredag','lördag'];
const months=['januari','februari','mars','april','maj','juni','juli','augusti','september','oktober','november','december'];
const iso=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function calendarDate(year:number,month:number,date:number){const d=new Date(year,month,date,12);return d.getFullYear()===year&&d.getMonth()===month&&d.getDate()===date?d:null;}

/** Local Swedish language heuristics. Ambiguous text remains an inbox capture. */
export function interpretCapture(input:string,areas:string[]=[],now=new Date()):CaptureIntent{
 const text=input.trim(),lower=text.toLocaleLowerCase('sv-SE'),warnings:string[]=[];
 let kind:Kind='capture',due='',time='',title=text,priority='Normal';
 const prefix=/^(?:lägg till\s+(?:en\s+|ett\s+)?)?(kalender(?:post)?|händelse|möte|to-?do|uppgift|att göra|anteckning|notera|idé|bokmärke|länk|påminnelse|påminn mig(?: om att| att| om)?|önskelista|önskar mig)(?:\s*[:\-]\s*|\s+)/iu.exec(text);
 const explicit:Record<string,Kind>={kalender:'event',kalenderpost:'event',händelse:'event',möte:'event','to-do':'task',todo:'task',uppgift:'task','att göra':'task',anteckning:'note',notera:'note',idé:'idea',bokmärke:'bookmark',länk:'bookmark',påminnelse:'reminder',önskelista:'wishlist','önskar mig':'wishlist'};
 if(prefix){const key=prefix[1].toLowerCase();kind=key.startsWith('påminn mig')?'reminder':explicit[key];title=key==='möte'&&!prefix[0].includes(':')?text:text.slice(prefix[0].length).trim()||text;}
 else if(/https?:\/\/\S+/iu.test(text))kind='bookmark';
 else if(/^(?:jag (?:vill|skulle vilja) ha|vill köpa|önskar mig)\b/iu.test(text))kind='wishlist';
 else if(/^(?:en idé|tänk om|idé till|jag har en idé)\b/iu.test(text))kind='idea';
 else if(/^(?:kom ihåg|glöm inte|påminn mig)\b/iu.test(text))kind='reminder';
 else if(/^(?:(?:jag\s+)?(?:måste|behöver|ska|vill|att)\s+)?(?:boka|köp(?:a)?|handla|ring(?:a)?|skriv(?:a)?|skicka|betala|fixa|laga|hämta|lämna|läs(?:a)?|städa|gör(?:a)?|planera|kolla|besvara|svara|förbered(?:a)?|tvätta|beställ(?:a)?)\b/iu.test(text))kind='task';
 else if(/\b(?:möte|fika|lunch|middag|tandläkare|läkarbesök|yoga|träning|kalas|konsert|föreläsning|besök|intervju|avstämning|träffa)\b/iu.test(text)||/^vi ses\b/iu.test(text))kind='event';
 else if(/^(?:anteckna|spara en anteckning|dagbok|reflektion|jag tänker|jag känner)\b/iu.test(text)||text.includes('\n'))kind='note';

 // Notes, ideas and bookmarks preserve dates as content rather than scheduling them.
 if(['task','event','reminder','capture'].includes(kind)){
  const datePattern=/\b(?:(\d{4})-(\d{2})-(\d{2})|(\d{1,2})[/.](\d{1,2})(?:[/.](\d{4}))?)\b/gu;
  const absolute=Array.from(lower.matchAll(datePattern)).find(m=>!/(?:kl(?:ockan)?\.?)\s*$/u.test(lower.slice(0,m.index)));
  const named=new RegExp('\\b(\\d{1,2})\\s+('+months.join('|')+')(?:\\s+(\\d{4}))?\\b','u').exec(lower);
  const relative=/\b(?:i\s*övermorgon|övermorgon|i\s*morgon|imorgon|i\s*dag|idag|om\s+(\d+)\s+(dagar?|veckor?))\b/u.exec(lower);
  const weekday=new RegExp('\\b(?:(nästa|på)\\s+)?('+weekdays.join('|')+')\\b','u').exec(lower);
  let found:Date|null=null;
  if(absolute){const year=Number(absolute[1]||absolute[6]||now.getFullYear()),month=Number(absolute[2]||absolute[5])-1,date=Number(absolute[3]||absolute[4]);found=calendarDate(year,month,date);if(found&&!absolute[1]&&!absolute[6]&&iso(found)<iso(now))found=calendarDate(year+1,month,date);if(!found)warnings.push('Datumet verkar inte finnas. Välj ett datum.');}
  else if(named){const year=Number(named[3]||now.getFullYear());found=calendarDate(year,months.indexOf(named[2]),Number(named[1]));if(found&&!named[3]&&iso(found)<iso(now))found=calendarDate(year+1,months.indexOf(named[2]),Number(named[1]));if(!found)warnings.push('Datumet verkar inte finnas. Välj ett datum.');}
  else if(relative){found=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);const delta=relative[1]?Number(relative[1])*(relative[2].startsWith('veck')?7:1):relative[0].includes('övermorgon')?2:relative[0].includes('morgon')?1:0;found.setDate(found.getDate()+delta);}
  else if(weekday){found=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);let delta=(weekdays.indexOf(weekday[2])-now.getDay()+7)%7;if(weekday[1]==='nästa'){const mondayOffset=(now.getDay()+6)%7;delta=7-mondayOffset+(weekdays.indexOf(weekday[2])+6)%7;}else if(delta===0)delta=7;found.setDate(found.getDate()+delta);}
  if(found&&Number.isFinite(found.getTime()))due=iso(found);
  const clock=/(?:\b(?:kl(?:ockan)?\.?)\s*(\d{1,2})(?:[:.](\d{2}))?\b|\b(\d{1,2}):(\d{2})\b)/u.exec(lower);
  if(clock){const h=Number(clock[1]||clock[3]),m=Number(clock[2]||clock[4]||0);if(h<24&&m<60)time=`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;else warnings.push('Kontrollera klockslaget.');}
  if(kind==='capture'&&due&&time)kind='event';
  if(kind==='event'&&!due)warnings.push('Vilken dag? Välj datum för kalenderposten.');
  if(kind==='capture')warnings.push('Jag är osäker på typen. Sparas som en tanke, eller välj en annan typ.');
 }
 if(/\b(?:bråttom|akut|viktigt|hög prioritet)\b/iu.test(text))priority='High';
 const tags=Array.from(text.matchAll(/(?:^|\s)#([\p{L}\p{N}_-]+)/gu),m=>m[1]);
 const explicitArea=areas.find(a=>lower.includes('@'+a.toLocaleLowerCase('sv-SE')))||'';
 if(kind!=='note')title=title.split('\n')[0].replace(/(?:^|\s)#[\p{L}\p{N}_-]+/gu,'').trim()||text;
 const body=kind==='note'?title:kind==='bookmark'?(text.match(/https?:\/\/\S+/iu)?.[0]||text):`Originaltext: ${text}`;
 if(kind==='note')title=title.split('\n')[0].replace(/^#+\s*/u,'').slice(0,100)||'Anteckning';
 return {kind,title,body,due,time,priority,area:explicitArea,tags:tags.join(', '),warnings};
}
