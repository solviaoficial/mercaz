import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID, createHmac } from 'node:crypto';
const dir = mkdtempSync(path.join(tmpdir(), 'mercaz-test-'));
process.env.DATA_DIR = dir;
process.env.NO_LISTEN = 'true';
process.env.PAYMENT_MODE = 'demo';
process.env.SEED_DEMO = 'true';
process.env.DEMO_PASSWORD = 'TesteMercaz2026!';
process.env.ADMIN_EMAILS = 'comprador@mercaz.local';
const { app } = await import('../server/index.mjs');
const { db, one, run, all } = await import('../server/db.mjs');
const { applyPayment, validSignature, release } = await import('../server/payments.mjs').then(async (m) => ({
    ...m,
    release: (await import('../server/db.mjs')).release,
}));
const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
});
const base = 'http://127.0.0.1:' + server.address().port;
after(async () => {
    await new Promise((r) => server.close(r));
    await db.close();
    rmSync(dir, { recursive: true, force: true });
});
async function call(url, body, who = '', method) {
    const r = await fetch(base + '/api' + url, {
        method: method || (body ? 'POST' : 'GET'),
        headers: {
            'Content-Type': 'application/json',
            'X-Mercaz-Client': 'web',
            Cookie: who,
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return {
        code: r.status,
        data: await r.json(),
        cookie: r.headers.get('set-cookie')?.split(';')[0],
    };
}
const address = {
    name: 'Pessoa Teste',
    zip: '01310000',
    street: 'Avenida de Teste',
    number: '100',
    extra: '',
    city: 'São Paulo',
    state: 'SP',
};
let buyer, seller, other, newUser, orderId;
test('Autenticação, isolamento e perfil', async (t) => {
    await t.test('rotas privadas exigem conta', async () => assert.equal((await call('/orders')).code, 401));
    await t.test('login inválido não revela conta', async () => {
        assert.equal((await call('/auth/login', {
            email: 'comprador@mercaz.local',
            password: 'errada',
        })).code, 401);
        assert.equal((await call('/auth/login', {
            email: 'nao@existe.local',
            password: 'errada',
        })).code, 401);
    });
    await t.test('sessões de compradores e vendedores', async () => {
        buyer = (await call('/auth/login', {
            email: 'comprador@mercaz.local',
            password: process.env.DEMO_PASSWORD,
        })).cookie;
        seller = (await call('/auth/login', {
            email: 'vendedor1@mercaz.local',
            password: process.env.DEMO_PASSWORD,
        })).cookie;
        other = (await call('/auth/login', {
            email: 'vendedor2@mercaz.local',
            password: process.env.DEMO_PASSWORD,
        })).cookie;
        assert.ok(buyer && seller && other);
        assert.equal((await call('/seller', null, buyer)).code, 403);
    });
    await t.test('proteção de origem e cabeçalho anti-CSRF', async () => {
        const r = await fetch(base + '/api/favorites', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Cookie: buyer,
                Origin: 'https://outro.exemplo',
            },
            body: '{}',
        });
        assert.equal(r.status, 403);
    });
    await t.test('cadastro, favorito e endereço persistem', async () => {
        const r = await call('/auth/register', {
            name: 'Nova Pessoa',
            email: 'nova@teste.local',
            password: 'SenhaNovaTeste2026!',
        });
        assert.equal(r.code, 201);
        newUser = r.cookie;
        assert.equal((await call('/account', { name: 'Nome Atualizado', address }, newUser, 'PATCH')).code, 200);
        assert.equal((await call('/favorites', { kind: 'product', item_id: 47 }, newUser))
            .code, 200);
        const d = (await call('/bootstrap', null, newUser)).data;
        assert.equal(d.user.name, 'Nome Atualizado');
        assert.equal(d.favorites[0].item_id, 47);
        assert.equal((await call('/auth/register', {
            name: 'Nova Pessoa',
            email: 'nova@teste.local',
            password: 'SenhaNovaTeste2026!',
        })).code, 409);
    });
    await t.test('vendedor não edita produto alheio', async () => assert.equal((await call('/products/47/stock', { stock: 50 }, other, 'PATCH')).code, 404));
});
test('Compra transacional e estoque', async (t) => {
    await t.test('preço do cliente é ignorado e pedidos são separados por loja', async () => {
        const key = randomUUID(), r = await call('/checkout', {
            key,
            address,
            accepted: true,
            items: [
                { id: 47, qty: 2, variant: 'Modelo único', price: 1 },
                { id: 101, qty: 1, variant: 'Prata', price: 1 },
            ],
        }, buyer);
        assert.equal(r.code, 201);
        assert.equal(r.data.orders.length, 2);
        const o = r.data.orders.find((o) => o.store_id === 1);
        orderId = o.id;
        assert.equal(o.subtotal, 29980);
        assert.equal(o.total, 31970);
        assert.equal((await one('SELECT stock FROM products WHERE id=47')).stock, 16);
        const repeat = await call('/checkout', { key, address, accepted: true, items: [] }, buyer);
        assert.equal(repeat.code, 200);
        assert.equal(repeat.data.orders.length, 2);
        assert.equal((await one('SELECT stock FROM products WHERE id=47')).stock, 16);
    });
    await t.test('estoque insuficiente desfaz todos os grupos', async () => {
        const before = (await one('SELECT stock FROM products WHERE id=101')).stock;
        const r = await call('/checkout', {
            key: randomUUID(),
            address,
            accepted: true,
            items: [
                { id: 101, qty: 1, variant: 'Prata' },
                { id: 47, qty: 99, variant: 'Modelo único' },
            ],
        }, buyer);
        assert.equal(r.code, 409);
        assert.equal((await one('SELECT stock FROM products WHERE id=101')).stock, before);
    });
    await t.test('quantidades negativas, variações falsas e itens duplicados falham', async () => {
        for (const items of [
            [{ id: 47, qty: -1, variant: 'Modelo único' }],
            [{ id: 47, qty: 1, variant: 'Inexistente' }],
            [
                { id: 47, qty: 1, variant: 'Modelo único' },
                { id: 47, qty: 1, variant: 'Modelo único' },
            ],
        ])
            assert.equal((await call('/checkout', { key: randomUUID(), address, accepted: true, items }, buyer)).code, 400);
    });
    await t.test('outro comprador e outra loja não leem o pedido', async () => {
        assert.equal((await call('/orders/' + orderId, null, newUser)).code, 404);
        assert.equal((await call('/orders/' + orderId, null, other)).code, 404);
        assert.equal((await call('/orders/' + orderId, null, seller)).code, 200);
    });
    await t.test('avaliação antes da entrega é bloqueada', async () => assert.equal((await call('/reviews', {
        order_id: orderId,
        product_id: 47,
        rating: 5,
        text: 'Ótimo produto',
    }, buyer)).code, 400));
    await t.test('vendedor não pula etapas nem confirma pagamento', async () => {
        assert.equal((await call('/seller/orders/' + orderId + '/status', { status: 'confirmed' }, seller)).code, 400);
        assert.equal((await call('/seller/orders/' + orderId + '/status', { status: 'shipped' }, seller)).code, 400);
    });
    await t.test('pagamento idempotente e fluxo completo até entrega', async () => {
        assert.equal((await call('/orders/' + orderId + '/simulate', {}, buyer)).code, 200);
        await call('/orders/' + orderId + '/simulate', {}, buyer);
        assert.equal((await all("SELECT * FROM events WHERE order_id=? AND status='confirmed'", orderId)).length, 1);
        for (const state of ['preparing', 'ready', 'shipped', 'transit'])
            assert.equal((await call('/seller/orders/' + orderId + '/status', { status: state, tracking: 'Correios TESTE12345' }, seller)).code, 200);
        assert.equal((await call('/orders/' + orderId + '/delivered', {}, buyer)).code, 200);
        assert.equal((await one('SELECT status FROM orders WHERE id=?', orderId)).status, 'delivered');
    });
    await t.test('avaliação verificada, reação e moderação', async () => {
        const r = await call('/reviews', {
            order_id: orderId,
            product_id: 47,
            rating: 4,
            text: 'O acabamento é bom e o tamanho atendeu.',
            media: [],
        }, buyer);
        assert.equal(r.code, 201);
        assert.equal((await call('/reviews', { order_id: orderId, product_id: 47, rating: 4, text: 'Repetida' }, buyer)).code, 409);
        assert.equal((await call('/reviews/' + r.data.id + '/helpful', {}, newUser)).code, 200);
        assert.equal((await call('/reviews/' + r.data.id + '/report', { reason: 'Teste de análise de conteúdo' }, newUser)).code, 201);
        assert.equal((await call('/admin/reports', null, newUser)).code, 403);
        const reports = (await call('/admin/reports', null, buyer)).data;
        assert.equal(reports.length, 1);
        assert.equal((await call('/admin/reports/' + reports[0].id, { hide: false }, buyer))
            .code, 200);
    });
    await t.test('suporte conversa entre comprador e loja', async () => {
        const r = await call('/tickets', {
            order_id: orderId,
            type: 'Dúvida',
            text: 'Preciso de ajuda com meu pedido.',
        }, buyer);
        assert.equal(r.code, 201);
        assert.equal((await call('/tickets/' + r.data.id, null, other)).code, 404);
        assert.equal((await call('/tickets/' + r.data.id + '/messages', { text: 'Como podemos ajudar?' }, seller)).code, 200);
        assert.equal((await call('/tickets/' + r.data.id, null, buyer)).data.messages.length, 2);
    });
    await t.test('reembolso devolve estoque uma única vez', async () => {
        assert.equal((await call('/seller/orders/' + orderId + '/refund', {}, seller)).code, 200);
        assert.equal((await one('SELECT stock FROM products WHERE id=47')).stock, 18);
        await release(orderId, 'refunded');
        assert.equal((await one('SELECT stock FROM products WHERE id=47')).stock, 18);
        assert.equal((await call('/seller/orders/' + orderId + '/refund', {}, seller)).code, 400);
    });
    await t.test('cancelamento pendente libera reserva', async () => {
        const r = await call('/checkout', {
            key: randomUUID(),
            address,
            accepted: true,
            items: [{ id: 47, qty: 1, variant: 'Modelo único' }],
        }, buyer);
        const id = r.data.orders[0].id;
        await call('/orders/' + id + '/cancel', {}, buyer);
        assert.equal((await one('SELECT stock FROM products WHERE id=47')).stock, 18);
    });
});
test('Conteúdo, uploads e assistente', async (t) => {
    await t.test('upload disfarçado de imagem é rejeitado', async () => {
        const f = new FormData();
        f.append('file', new Blob(['<svg onload=alert(1)>'], { type: 'image/png' }), 'fake.png');
        const r = await fetch(base + '/api/uploads', {
            method: 'POST',
            headers: { Cookie: seller, 'X-Mercaz-Client': 'web' },
            body: f,
        });
        assert.equal(r.status, 400);
    });
    await t.test('upload autorizado e criação de anúncio persistente', async () => {
        const f = new FormData();
        f.append('file', new Blob([
            Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000b49444154789c636000020000050001a5f645400000000049454e44ae426082', 'hex'),
        ], { type: 'image/png' }), 'teste.png');
        const r = await fetch(base + '/api/uploads', {
            method: 'POST',
            headers: { Cookie: seller, 'X-Mercaz-Client': 'web' },
            body: f,
        });
        assert.equal(r.status, 201);
        const { url } = await r.json();
        const b = {
            title: 'Produto para teste',
            description: 'Descrição detalhada para teste de produto.',
            category: 'Casa e decoração',
            price: 12345,
            stock: 2,
            images: [url],
            variants: ['Único'],
            status: 'active',
        };
        const p = await call('/products', b, seller);
        assert.equal(p.code, 201);
        assert.equal((await call('/products/' + p.data.id)).data.price, 12345);
        assert.equal((await call('/products', b, other)).code, 400);
    });
    await t.test('pergunta e resposta vinculadas à loja correta', async () => {
        await call('/questions', { product_id: 47, question: 'Qual é o tamanho deste produto?' }, buyer);
        const id = (await one('SELECT id FROM questions ORDER BY id DESC')).id;
        assert.equal((await call('/questions/' + id + '/answer', { answer: 'Vamos conferir as medidas.' }, other)).code, 404);
        assert.equal((await call('/questions/' + id + '/answer', { answer: 'Vamos conferir as medidas.' }, seller)).code, 200);
    });
    await t.test('assistente sem chave é explicitamente checklist', async () => {
        const r = await call('/seller/assistant', {
            title: 'Produto   exemplo',
            description: 'Uma descrição objetiva para revisão.',
        }, seller);
        assert.equal(r.code, 200);
        assert.equal(r.data.mode, 'checklist');
        assert.equal(r.data.title, 'Produto exemplo');
    });
});
test('Contrato de pagamentos e assinaturas', async (t) => {
    await t.test('assinatura HMAC autêntica, alterada e expirada', () => {
        process.env.MP_WEBHOOK_SECRET = 'segredo-apenas-teste';
        const ts = String(Date.now()), id = '123', rid = 'req-1';
        const sig = createHmac('sha256', process.env.MP_WEBHOOK_SECRET)
            .update(`id:${id};request-id:${rid};ts:${ts};`)
            .digest('hex');
        const req = {
            query: { 'data.id': id },
            headers: { 'x-request-id': rid, 'x-signature': `ts=${ts},v1=${sig}` },
        };
        assert.equal(validSignature(req), true);
        req.query['data.id'] = '999';
        assert.equal(validSignature(req), false);
        req.headers['x-signature'] = 'ts=1,v1=' + sig;
        assert.equal(validSignature(req), false);
    });
    await t.test('aprovação exige valor, moeda e referência correspondentes', async () => {
        const o = await one("SELECT * FROM orders WHERE status='pending' LIMIT 1");
        assert.ok(o);
        await assert.rejects(async () => await applyPayment(o, {
            status: 'approved',
            external_reference: o.id,
            transaction_amount: 0.01,
            currency_id: 'BRL',
        }));
        await assert.rejects(async () => await applyPayment(o, {
            status: 'approved',
            external_reference: 'outro',
            transaction_amount: o.total / 100,
            currency_id: 'BRL',
        }));
        await assert.rejects(async () => await applyPayment(o, {
            status: 'approved',
            external_reference: o.id,
            transaction_amount: o.total / 100,
            currency_id: 'USD',
        }));
        assert.equal((await one('SELECT status FROM orders WHERE id=?', o.id)).status, 'pending');
        await applyPayment(o, {
            status: 'approved',
            external_reference: o.id,
            transaction_amount: o.total / 100,
            currency_id: 'BRL',
        });
        assert.equal((await one('SELECT status FROM orders WHERE id=?', o.id)).status, 'confirmed');
    });
    await t.test('webhook falso não altera pedidos', async () => {
        const r = await fetch(base + '/api/payments/webhook?data.id=1', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
        });
        assert.equal(r.status, 401);
    });
});
