import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixture } from './sqlite'
import { createApp } from '../src/index'
import { categorySlots } from '../../web/src/lib/customer/availability'
import { parseBookingDraft, bookingDraftSummary } from '../../web/src/lib/customer/booking-draft'

test('Racing quantities validate, allocate distinct ordered machines, and temporarily bypass overlaps', async t => {
 const {db,d1}=fixture(); t.after(()=>db.close())
 db.exec(`INSERT INTO business(id,name) VALUES ('a','A'),('b','B');
 INSERT INTO customer(id,name,phone) VALUES ('c','Guest','123');
 INSERT INTO room_category VALUES ('r','a','Racing','RACING',0),('f','a','Family','FR',1),('foreign','b','Racing','RACING',0);
 INSERT INTO room VALUES ('4','r','R4',4),('2','r','R2',2),('1','r','R1',1),('3','r','R3',3),('f1','f','F1',1);`)
 const app=createApp();
 const create=(quantity?:unknown, category='r',from='2030-01-01T02:00:00.000Z',duration=60)=>app.request('/v1/bookings',{method:'POST',body:JSON.stringify({business_id:'a',customer_id:'c',room_category_id:category,from,duration,...(quantity===undefined?{}:{quantity})})},{DB:d1})
 const counts=()=>['booking','room_reservation','payment','demo_payment_order'].map(table=>db.prepare(`SELECT count(*) n FROM ${table}`).get()!.n)
 for(const q of [null,'2',0,5,1.5,true]) assert.equal((await create(q)).status,400)
 assert.equal((await create(2,'f')).status,400)
 for(const category of ['foreign','missing']) assert.equal((await create(2,category)).status,404)
 for(const q of [undefined,1,2,3,4]) {
  db.exec('DELETE FROM room_reservation; DELETE FROM booking;')
  assert.equal((await create(q)).status,201)
  assert.deepEqual(db.prepare('SELECT room_id FROM room_reservation ORDER BY rowid').all().map(r=>r.room_id),['1','2','3','4'].slice(0,q??1))
  assert.equal(db.prepare('SELECT count(*) n FROM booking').get()!.n,1)
 }
 assert.equal((await create()).status,201)
 db.exec("DELETE FROM room_reservation; DELETE FROM booking; DELETE FROM room WHERE id='4';")
 const before=counts(); assert.equal((await create(4)).status,409); assert.deepEqual(counts(),before)
 db.exec("INSERT INTO room VALUES ('4','r','R4',4)")
 assert.equal((await create(4,'r','2030-01-01T03:00:00.000Z')).status,201)
 db.exec("UPDATE booking SET status='pending',expire_at='9999-01-01T00:00:00.000Z'")
 assert.equal((await create()).status,201)
 db.exec("UPDATE booking SET expire_at='2000-01-01T00:00:00.000Z'")
 assert.equal((await create(4)).status,201)
 db.exec("UPDATE booking SET status='cancelled'")
 assert.equal((await create(4)).status,201)
 assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[])
})

test('capacity counts continuous machines for each duration; drafts preserve quantity',()=>{
 const opening=Date.parse('2030-01-01T02:00:00Z'), closing=opening+120*60000
 const slots=categorySlots([{id:'r',name:'RACING',acronym:'RACING',room_ids:['1','2']}],[{room_id:'1',status:'confirmed',expire_at:'',from:new Date(opening+60*60000).toISOString(),to:new Date(closing).toISOString()}],opening,closing,opening)
 assert.deepEqual(slots[0].capacity,{60:2,120:1})
 const draft={date:'2030-01-01',room:{id:'r',name:'RACING'},time:'10:00',duration:60}
 assert.deepEqual(parseBookingDraft(JSON.stringify(draft)),draft)
 for(const quantity of [1,2,3,4]) {
 const parsed=parseBookingDraft(JSON.stringify({...draft,quantity}))!
 assert.equal(parsed.quantity,quantity); assert.equal(bookingDraftSummary(parsed)[1].text,`RACING × ${quantity}`)
 }
 for(const quantity of [null,0,5,'2',1.5]) assert.equal(parseBookingDraft(JSON.stringify({...draft,quantity})),null)
})

test('Racing temporarily allows full-interval conflicts and bypasses upfront payment',async t=>{
 const {db,d1}=fixture();t.after(()=>db.close())
 db.exec(`INSERT INTO business(id,name) VALUES ('a','A');
 INSERT INTO customer(id,name,phone) VALUES ('c','Guest','123');
 INSERT INTO room_category VALUES ('r','a','RACING','RACING',0);
 INSERT INTO room VALUES ('1','r','R1',1),('2','r','R2',2);
 INSERT INTO upfront_payment_policy VALUES ('a',0);
 INSERT INTO booking VALUES ('b1','c','confirmed','now','now'),('b2','c','confirmed','now','now');
 INSERT INTO room_reservation VALUES ('res1','b1','1','2030-01-01T02:00:00.000Z','2030-01-01T02:30:00.000Z','r'),('res2','b2','2','2030-01-01T02:30:00.000Z','2030-01-01T03:00:00.000Z','r');`)
 const app=createApp();const create=(from:string,quantity:number)=>app.request('/v1/bookings',{method:'POST',body:JSON.stringify({business_id:'a',customer_id:'c',room_category_id:'r',from,duration:60,quantity})},{DB:d1})
 assert.equal((await create('2030-01-01T02:00:00.000Z',1)).status,201)
 assert.equal(db.prepare('SELECT count(*) n FROM booking').get()!.n,3)
 assert.equal(db.prepare('SELECT count(*) n FROM payment').get()!.n,0)
 const response=await create('2030-01-01T03:00:00.000Z',2);assert.equal(response.status,201)
 assert.equal(db.prepare('SELECT count(*) n FROM payment').get()!.n,0)
 assert.equal(db.prepare('SELECT count(*) n FROM demo_payment_order').get()!.n,0)
 const result=await response.json() as {booking_id:string;payment_url:null};assert.equal(result.payment_url,null)
 assert.equal(db.prepare('SELECT count(*) n FROM room_reservation WHERE booking_id=?').get(result.booking_id)!.n,2)
})
