import { test } from 'node:test'
import assert from 'node:assert/strict'
import { blankDraft, options, overlaps, free, payload, firstAvailable } from '../../admin/src/lib/reservation/reservation-editor'
const now = Date.parse('2026-11-13T00:00:00Z')
const rooms = [{id:'r1',name:'R1',room_category_id:'cat'},{id:'r2',name:'R2',room_category_id:'cat'}]
const row = {...blankDraft(now),category:'cat',room:'r1',selectedRooms:['r1'],date:'2026-11-14',time:'10:00:00.000',duration:60}
const busy = {id:'other',room_id:'r1',from:'2026-11-14T02:00:00Z',to:'2026-11-14T03:00:00Z',status:'confirmed',expire_at:''}
test('one blank selection uses today and no stored values or rooms',()=>{
 assert.deepEqual(blankDraft(now),{category:'',room:'',selectedRooms:[],date:'2026-11-13',time:'',duration:0})
 assert.deepEqual(payload([blankDraft(now)]),{reservations:[]})
 assert.deepEqual(options(blankDraft(now),'02:00','06:00',[],'self',now),[])
})
test('room conflicts exclude self, cancelled, expired and adjacent intervals',()=>{
 assert.equal(free(row,[busy],'self',now),false)
 assert.equal(free(row,[busy],'other',now),true)
 assert.equal(free({...row,room:'r2'},[busy],'self',now),true)
 assert.equal(free({...row,time:'11:00:00.000'},[busy],'self',now),true)
 for(const r of [{...busy,status:'cancelled'},{...busy,status:'pending',expire_at:'2020-01-01T00:00:00Z'}]) assert.equal(free(row,[r],'self',now),true)
 assert.equal(free(row,[{...busy,status:'pending',expire_at:'2027-01-01T00:00:00Z'}],'self',now),false)
 assert.equal(overlaps([row,{...row,time:'11:00:00.000'}]),false)
 assert.equal(overlaps([row,{...row,time:'10:45:00.000'}]),true)
})
test('choices use quarter starts, whole hours and full interval availability',()=>{
 const slots = options(row,'02:00','06:00',[{...busy,from:'2026-11-14T03:30:00Z',to:'2026-11-14T04:00:00Z'}],'self',now)
 assert.deepEqual(slots.find(s=>s.time==='10:00:00.000')?.durations,[60])
 assert.equal(slots.some(s=>s.time==='10:45:00.000'),false)
 assert.deepEqual(slots.at(-1),{time:'13:00:00.000',durations:[60]})
 assert.deepEqual(options(row,null,'06:00',[],'self',now),[])
 assert.deepEqual(options({...row,date:'2020-01-01'},'02:00','06:00',[],'self',now),[])
})
test('Racing selection expands only newly selected rooms and detects overlaps',()=>{
 const multi = {...row,selectedRooms:['r1','r2']}
 assert.deepEqual(payload([multi]),{reservations:[{room_id:'r1',from:'2026-11-14T02:00:00.000Z',duration:60},{room_id:'r2',from:'2026-11-14T02:00:00.000Z',duration:60}]})
 assert.equal(options(multi,'02:00','06:00',[{...busy,room_id:'r2'}],'self',now).some(s=>s.time==='10:00:00.000'),false)
 assert.equal(overlaps([multi,{...row,selectedRooms:['r2'],time:'10:30:00.000'}]),true)
 assert.equal(overlaps([multi,{...row,selectedRooms:['r2'],time:'11:00:00.000'}]),false)
})
test('category defaults use first room and time, avoid draft conflicts and default duration',()=>{
 assert.deepEqual(firstAvailable({...row,duration:120},rooms,'02:00','06:00',[busy],'self',[],now),{room:'r1',selectedRooms:['r1'],time:'11:00:00.000',duration:120})
 assert.equal(firstAvailable(row,rooms,'02:00','06:00',[],'self',[{...row,duration:240}],now).room,'r2')
 assert.equal(firstAvailable({...row,duration:0},rooms,'02:00','06:00',[],'self',[],now).duration,60)
 assert.equal(firstAvailable(row,rooms,null,'06:00',[],'self',[],now).room,'')
 assert.equal(firstAvailable({...row,category:'missing'},rooms,'02:00','06:00',[],'self',[],now).time,'')
})

test('initial defaults choose the first available category and skip full or empty categories',async()=>{
 const {firstAvailableCategory} = await import('../../admin/src/lib/reservation/reservation-editor')
 const draft = {...blankDraft(now),date:row.date}
 const categories = [{id:'empty'},{id:'family'},{id:'cat'}]
 const roster = [{id:'family-room',name:'Family',room_category_id:'family'},...rooms]
 const defaults = firstAvailableCategory(draft,categories,roster,'02:00','06:00',[],'self',[],now)
 assert.deepEqual(defaults,{category:'family',room:'family-room',selectedRooms:['family-room'],time:'10:00:00.000',duration:60})
 const blocked = {...busy,room_id:'family-room',to:'2026-11-14T06:00:00Z'}
 assert.equal(firstAvailableCategory(draft,categories,roster,'02:00','06:00',[blocked],'self',[],now).category,'cat')
 assert.equal(firstAvailableCategory(draft,categories,roster,null,'06:00',[],'self',[],now).category,'')
})
