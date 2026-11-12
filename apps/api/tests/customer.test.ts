import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { URL } from 'node:url';
import { CreateCustomer } from '../src/customer/CreateCustomer';
import { UpdateCustomer } from '../src/customer/UpdateCustomer';
import { QueryCustomer } from '../src/customer/QueryCustomer';
import { Customer } from '../src/value-objects/Customer';
import { Guid } from '../src/value-objects/Guid';
import { Name } from '../src/value-objects/Name';
import { Phone } from '../src/value-objects/Phone';
import { NotFoundError } from '../src/errors';
import { createApp } from '../src/index';

const migrations = new URL('../migrations/', import.meta.url);
const customerMigration = readFileSync(new URL('0006_create_customer.sql', migrations), 'utf8');
const createdAtMigration = readFileSync(new URL('0007_customer_created_at.sql', migrations), 'utf8');

function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec(customerMigration);
  db.exec(createdAtMigration);
  const d1 = {
    prepare(sql: string) {
      const statement = db.prepare(sql);
      return {
        bind(...values: string[]) {
          return {
            async run() {
              return { meta: { changes: Number(statement.run(...values).changes) } };
            },
            async first() {
              const row = statement.get(...values);
              return row ? { ...row } : null;
            },
          };
        },
      };
    },
  } as unknown as D1Database;
  const app = createApp();
  return {
    db, create: new CreateCustomer(d1), update: new UpdateCustomer(d1), query: new QueryCustomer(d1),
    request: (path: string, init?: RequestInit) => app.request(path, init, { DB: d1 }),
  };
}

test('customer POST and PUT routes persist validated input and generate creation metadata', async (t) => {
  const { db, request, query } = fixture();
  t.after(() => db.close());
  const response = await request('/v1/customers', {
    method: 'POST', body: JSON.stringify({ name: 'Guest', phone: '0123456789', id: 'client-id', createdAt: 'client-time', created_at: 'client-time' }),
  });
  assert.equal(response.status, 201);
  const customer = await response.json() as { id: string; name: string; phone: string };
  assert.match(customer.id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(customer, { id: customer.id, name: 'Guest', phone: '0123456789' });
  const stored = await query.query(Guid.from(customer.id));
  assert.ok(stored && Number.isFinite(Date.parse(stored.created_at)));
  const retrieved = await request(`/v1/customers/${customer.id}`);
  assert.equal(retrieved.status, 200);
  assert.deepEqual(await retrieved.json(), { ...customer, created_at: stored.created_at });
  const updated = await request(`/v1/customers/${customer.id}`, {
    method: 'PUT', body: JSON.stringify({ id: 'different', name: 'Updated', phone: '+60111111111', created_at: 'client-time' }),
  });
  assert.equal(updated.status, 200);
  assert.deepEqual(await updated.json(), { id: customer.id, name: 'Updated', phone: '+60111111111' });
  assert.deepEqual(await query.query(Guid.from(customer.id)), { id: customer.id, name: 'Updated', phone: '+60111111111', created_at: stored.created_at });
  const retrievedAfterUpdate = await request(`/v1/customers/${customer.id}`);
  assert.equal(retrievedAfterUpdate.status, 200);
  assert.deepEqual(await retrievedAfterUpdate.json(), { id: customer.id, name: 'Updated', phone: '+60111111111', created_at: stored.created_at });
  const missingCustomer = await request('/v1/customers/missing');
  assert.equal(missingCustomer.status, 200);
  assert.equal(await missingCustomer.json(), null);
  const missing = await request('/v1/customers/missing', { method: 'PUT', body: JSON.stringify(customer) });
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: 'customer not found | id: missing' });
  for (const path of ['/v1/customers', `/v1/customers/${customer.id}`]) {
    for (const method of path === '/v1/customers' ? ['GET', 'QUERY'] : ['QUERY']) {
      assert.equal((await request(path, { method })).status, 404);
    }
  }
});

test('customer writes reject invalid JSON and fields without changing data', async (t) => {
  const { db, request } = fixture();
  t.after(() => db.close());
  db.exec("INSERT INTO customer (id, name, phone) VALUES ('guest', 'Guest', '0123456789')");
  const original = { ...db.prepare('SELECT * FROM customer').get() };
  const invalid = [undefined, '{', 'null', '[]', '{}', ...[
    { name: 'Guest' }, { phone: '0123456789' },
    ...[null, 1, true, {}, [], '', '  '].flatMap(value => [
      { name: value, phone: '0123456789' }, { name: 'Guest', phone: value },
    ]),
  ].map(value => JSON.stringify(value))];
  for (const method of ['POST', 'PUT']) {
    for (const body of invalid) {
      const response = await request('/v1/customers' + (method === 'PUT' ? '/guest' : ''), { method, body });
      assert.equal(response.status, 400, `${method}: ${body}`);
      assert.equal(typeof (await response.json() as { error: string }).error, 'string');
    }
  }
  assert.equal(db.prepare('SELECT count(*) AS count FROM customer').get()!.count, 1);
  assert.deepEqual({ ...db.prepare('SELECT * FROM customer').get() }, original);
});

test('customers persist, query by ID, and update without changing other customers', async (t) => {
  const { db, create, update, query } = fixture();
  t.after(() => db.close());
  const id = Guid.from('customer-1');
  assert.equal(await query.query(id), null);
  const before = Date.now();
  await create.exec(Customer.from(id, Name.from("Guest O'Brien"), Phone.from('+60123456789')));
  const after = Date.now();
  await create.exec(Customer.from(Guid.from('customer-2'), Name.from('Other'), Phone.from('0123456789')));
  const created = await query.query(id);
  assert.ok(created);
  assert.ok(Date.parse(created.created_at) >= before && Date.parse(created.created_at) <= after);
  assert.equal(db.prepare('SELECT created_at FROM customer WHERE id = ?').get(id.value)!.created_at, created.created_at);
  assert.deepEqual(created, { id: id.value, name: "Guest O'Brien", phone: '+60123456789', created_at: created.created_at });
  const other = await query.query(Guid.from('customer-2'));
  // A fixed earlier date proves updates do not replace the creation timestamp.
  const originalCreatedAt = '2020-01-01T00:00:00.000Z';
  db.prepare('UPDATE customer SET created_at = ? WHERE id = ?').run(originalCreatedAt, id.value);
  const result = await update.exec(Customer.from(id, Name.from('Updated'), Phone.from('0012345678')));
  assert.equal(result.meta.changes, 1);
  assert.deepEqual(await query.query(id), { id: id.value, name: 'Updated', phone: '0012345678', created_at: originalCreatedAt });
  assert.deepEqual(await query.query(Guid.from('customer-2')), other);
  await assert.rejects(
    update.exec(Customer.from(Guid.from('missing'), Name.from('Missing'), Phone.from('0123456789'))),
    (error: unknown) => error instanceof NotFoundError && error.message === 'customer not found | id: missing',
  );
});

test('customer migration works after existing migrations and preserves customer and booking data', (t) => {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec('PRAGMA foreign_keys = ON');
  for (const file of readdirSync(migrations).filter(file => file.endsWith('.sql') && file < '0006').sort()) {
    db.exec(readFileSync(new URL(file, migrations), 'utf8'));
  }
  db.exec("INSERT INTO customer VALUES ('guest', 'Guest', '0123456789')");
  db.exec("INSERT INTO booking VALUES ('booking', 'guest', 'pending', '2026-11-03T00:00:00Z')");
  db.exec(customerMigration);
  db.exec(createdAtMigration);
  assert.equal(db.prepare('SELECT name FROM customer WHERE id = ?').get('guest')!.name, 'Guest');
  assert.ok(Number.isFinite(Date.parse(db.prepare('SELECT created_at FROM customer WHERE id = ?').get('guest')!.created_at as string)));
  assert.equal(db.prepare('SELECT customer_id FROM booking').get()!.customer_id, 'guest');
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});

test('customer schema requires unique IDs and non-null customer fields', (t) => {
  const { db } = fixture();
  t.after(() => db.close());
  db.exec("INSERT INTO customer (id, name, phone) VALUES ('guest', 'Guest', '0123456789')");
  for (const sql of [
    "INSERT INTO customer (id, name, phone) VALUES ('guest', 'Duplicate', '123')",
    "INSERT INTO customer (id, name, phone) VALUES (NULL, 'Guest', '123')",
    "INSERT INTO customer (id, name, phone) VALUES ('other', NULL, '123')",
    "INSERT INTO customer (id, name, phone) VALUES ('other', 'Guest', NULL)",
  ]) assert.throws(() => db.exec(sql));
});
