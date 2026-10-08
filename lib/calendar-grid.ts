import type {Item} from './personal-data';
import {day} from './personal-data';
import {eventTime,nextDate} from './google-calendar';
export function monthDays(month:Date){const first=new Date(month.getFullYear(),month.getMonth(),1,12);const start=new Date(first);start.setDate(1-(first.getDay()+6)%7);return Array.from({length:42},(_,index)=>{const date=new Date(start);date.setDate(start.getDate()+index);return {date,key:day(date),inMonth:date.getMonth()===first.getMonth()}})}
export function dayEvents(items:Item[],date:string){return items.filter(item=>{if(!item.due)return false;let end=item.endDate||item.due;if(eventTime(item)&&item.endTime==='00:00'&&end>item.due)end=nextDate(end,-1);return item.due<=date&&end>=date}).sort((a,b)=>{const aTime=eventTime(a),bTime=eventTime(b);return Number(Boolean(aTime))-Number(Boolean(bTime))||aTime.localeCompare(bTime)||a.title.localeCompare(b.title,'sv')})}
