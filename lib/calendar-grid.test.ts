import {test} from 'node:test';
import assert from 'node:assert/strict';
import {monthDays,dayEvents} from './calendar-grid';
import {makeItem} from './personal-data';
test('Month grid starts Monday and spans six complete weeks',()=>{const cells=monthDays(new Date(2026,9,7));assert.equal(cells.length,42);assert.equal(cells[0].key,'2026-09-28');assert.equal(cells[0].date.getDay(),1);assert.equal(cells.filter(c=>c.inMonth).length,31);assert.equal(cells[41].date.getDay(),0)});
test('Leap February and year boundaries',()=>{assert.equal(monthDays(new Date(2028,1,1)).filter(c=>c.inMonth).length,29);assert.equal(monthDays(new Date(2027,0,1))[0].key,'2026-12-28')});
test('Multi-day events cover start and inclusive end but exclude following day',()=>{const item={...makeItem('Ledigt','event'),due:'2026-10-07',endDate:'2026-10-09'};assert.equal(dayEvents([item],'2026-10-08').length,1);assert.equal(dayEvents([item],'2026-10-09').length,1);assert.equal(dayEvents([item],'2026-10-10').length,0)});
test('Timed events ending at midnight do not spill into the next day',()=>{const item={...makeItem('Kväll','event'),due:'2026-10-07',startTime:'22:00',endDate:'2026-10-08',endTime:'00:00'};assert.equal(dayEvents([item],'2026-10-07').length,1);assert.equal(dayEvents([item],'2026-10-08').length,0)});
test('All-day events sort before times and unscheduled events stay outside grid',()=>{const item=makeItem('A','event');const events=[{...item,id:'late',due:'2026-10-07',startTime:'15:00'},{...item,id:'early',due:'2026-10-07',startTime:'09:00'},{...item,id:'all',due:'2026-10-07'},item];assert.deepEqual(dayEvents(events,'2026-10-07').map(x=>x.id),['all','early','late'])});
