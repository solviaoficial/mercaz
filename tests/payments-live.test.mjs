import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
const dir = mkdtempSync(path.join(tmpdir(), 'mercaz-payment-test-'));
process.env.DATA_DIR = dir;
process.env.PAYMENT_MODE = 'mercadopago';
process.env.APP_URL = 'https://mercaz.example';
process.env.TOKEN_ENCRYPTION_KEY = 'ac'.repeat(32);
process.env.MP_CLIENT_ID = 'test-client';
process.env.MP_CLIENT_SECRET = 'test-secret';
const { db, one, run, passwordHash } = await import('../server/db.mjs');
const { encrypt, createPayment, syncPayment, refundPayment, tokenFor } = await import('../server/payments.mjs');
await run('INSERT INTO users(id,name,email,password) VALUES(1,?,?,?)', 'Comprador Teste', 'buyer@example.com', passwordHash('SenhaTesteSomente2026!'));
await run('INSERT INTO users(id,name,email,password) VALUES(2,?,?,?)', 'Loja Teste', 'store@example.com', passwordHash('SenhaTesteSomente2026!'));
await run('INSERT INTO stores(id,user_id,name,description,mp_token,mp_refresh,mp_expires) VALUES(1,2,?,?,?,?,?)', 'Loja Teste', 'Descrição da loja.', encrypt('seller-token'), encrypt('refresh-token'), Date.now() + 3600000);
await run("INSERT INTO products(id,store_id,title,description,category,price,stock,images) VALUES(1,1,'Produto','Descrição do produto','Casa e decoração',10000,2,'[]')");
const id = 'MCZ-' + randomUUID();
await run("INSERT INTO orders(id,user_id,store_id,subtotal,shipping,fee,total,address,prep_days,shipping_days,demo,checkout_key) VALUES(?,1,1,10000,1000,500,11000,'{}',2,5,0,?)", id, randomUUID());
await run("INSERT INTO order_items(order_id,product_id,title,image,variant,qty,price) VALUES(?,1,'Produto','/assets/test.webp','Único',1,10000)", id);
const originalFetch = globalThis.fetch, requests = [];
let first = true, providerStatus = 'pending';
globalThis.fetch = async (url, opts) => {
    assert.ok(String(url).startsWith('https://api.mercadopago.com/'));
    requests.push({ url, opts });
    if (String(url).endsWith('/oauth/token'))
        return Response.json({
            access_token: 'renewed-token',
            refresh_token: 'new-refresh',
            expires_in: 3600,
        });
    if (String(url).endsWith('/refunds')) {
        providerStatus = 'refunded';
        return Response.json({ id: 'refund-1', status: 'approved' });
    }
    if (opts.method === 'POST' && String(url).endsWith('/v1/payments') && first) {
        first = false;
        throw Error('simulated uncertain timeout');
    }
    return Response.json({
        id: 123456,
        status: providerStatus,
        external_reference: id,
        transaction_amount: 110,
        currency_id: 'BRL',
        point_of_interaction: {
            transaction_data: { qr_code: 'test-pix', qr_code_base64: 'test-qr' },
        },
    });
};
after(async () => {
    globalThis.fetch = originalFetch;
    await db.close();
    rmSync(dir, { recursive: true, force: true });
});
test('Pix marketplace: corpo, split, OAuth, timeout, confirmação e reembolso', async (t) => {
    await t.test('timeout conserva payload criptografado para recuperar sem nova cobrança', async () => {
        const o = await one('SELECT * FROM orders WHERE id=?', id);
        await assert.rejects(() => createPayment(o, { name: 'Comprador Teste', email: 'buyer@example.com' }, '12345678909'));
        const payload = (await one('SELECT payload FROM payment_requests WHERE order_id=?', id)).payload;
        assert.ok(!payload.includes('12345678909'));
        assert.equal((await one('SELECT payment_id FROM orders WHERE id=?', id)).payment_id, null);
    });
    await t.test('nova tentativa usa chave e corpo idênticos', async () => {
        const o = await one('SELECT * FROM orders WHERE id=?', id);
        await createPayment(o, { name: 'Nome diferente', email: 'outro@example.com' }, '00000000000');
        assert.equal(requests[0].opts.body, requests[1].opts.body);
        assert.equal(requests[0].opts.headers['X-Idempotency-Key'], id);
        assert.equal(requests[1].opts.headers.Authorization, 'Bearer seller-token');
        const body = JSON.parse(requests[1].opts.body);
        assert.equal(body.application_fee, 5);
        assert.equal(body.transaction_amount, 110);
        assert.equal(body.external_reference, id);
        assert.equal(body.payment_method_id, 'pix');
        assert.equal((await one('SELECT payment_id FROM orders WHERE id=?', id)).payment_id, '123456');
        assert.equal(await one('SELECT payload FROM payment_requests WHERE order_id=?', id), undefined);
    });
    await t.test('consulta ao provedor confirma pagamento uma vez', async () => {
        providerStatus = 'approved';
        await syncPayment(await one('SELECT * FROM orders WHERE id=?', id));
        await syncPayment(await one('SELECT * FROM orders WHERE id=?', id));
        assert.equal((await one('SELECT status FROM orders WHERE id=?', id)).status, 'confirmed');
        assert.equal((await one("SELECT COUNT(*) n FROM events WHERE order_id=? AND status='confirmed'", id)).n, 1);
    });
    await t.test('OAuth renova e persiste os tokens criptografados', async () => {
        await run('UPDATE stores SET mp_expires=0 WHERE id=1');
        assert.equal(await tokenFor(1), 'renewed-token');
        const s = await one('SELECT * FROM stores WHERE id=1');
        assert.notEqual(s.mp_token, 'renewed-token');
        assert.ok(s.mp_expires > Date.now());
        assert.equal(JSON.parse(requests.at(-1).opts.body).grant_type, 'refresh_token');
    });
    await t.test('reembolso usa chave estável e reconcilia com o provedor', async () => {
        await refundPayment(await one('SELECT * FROM orders WHERE id=?', id));
        assert.equal((await one('SELECT status FROM orders WHERE id=?', id)).status, 'refunded');
        const req = requests.find((r) => String(r.url).endsWith('/refunds'));
        assert.equal(req.opts.headers['X-Idempotency-Key'], 'refund-' + id);
    });
});
