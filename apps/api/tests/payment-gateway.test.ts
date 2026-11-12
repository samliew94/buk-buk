import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SelectPaymentGateway } from '../src/payment/SelectPaymentGateway';
import type { Demo } from '../src/payment/Demo';
import { Guid } from '../src/value-objects/Guid';

for (const configuration of [null, { business_id: 'business-1' }]) {
  test(`payment gateway selection for ${JSON.stringify(configuration)}`, async () => {
    const businessId = Guid.from('business-1');
    const demo = {} as Demo;
    const database = {
      prepare(sql: string) {
        assert.match(sql, /FROM business_payment_gateway/);
        return {
          bind(id: string) {
            assert.equal(id, businessId.value);
            return { first: async () => configuration };
          },
        };
      },
    } as unknown as D1Database;
    const selector = new SelectPaymentGateway(database, demo);

    assert.equal(await selector.select(businessId), demo);
  });
}
