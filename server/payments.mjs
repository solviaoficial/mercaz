import { createCipheriv, createDecipheriv, randomBytes, createHmac, timingSafeEqual, } from 'node:crypto';
import { one, all, run, status, release, transaction } from './db.mjs';
import { lockOrder } from './db.mjs';
if (!['demo', 'mercadopago'].includes(process.env.PAYMENT_MODE || 'demo'))
    throw Error('PAYMENT_MODE deve ser demo ou mercadopago.');
export const demo = process.env.PAYMENT_MODE !== 'mercadopago';
export const feeBps = Number(process.env.PLATFORM_FEE_BPS || 500);
if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 3000)
    throw Error('PLATFORM_FEE_BPS deve estar entre 0 e 3000.');
function key() {
    const b = Buffer.from(process.env.TOKEN_ENCRYPTION_KEY || '', 'hex');
    if (b.length !== 32)
        throw Error('TOKEN_ENCRYPTION_KEY precisa ter 64 caracteres hexadecimais.');
    return b;
}
export function encrypt(t) {
    const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', key(), iv);
    const data = Buffer.concat([c.update(t, 'utf8'), c.final()]);
    return [
        iv.toString('hex'),
        c.getAuthTag().toString('hex'),
        data.toString('hex'),
    ].join('.');
}
function decrypt(t) {
    const [iv, tag, data] = t.split('.'), c = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'hex'));
    c.setAuthTag(Buffer.from(tag, 'hex'));
    return Buffer.concat([
        c.update(Buffer.from(data, 'hex')),
        c.final(),
    ]).toString('utf8');
}
export async function mp(path, token, body, method = 'POST', idempotency) {
    const r = await fetch('https://api.mercadopago.com' + path, {
        method,
        headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json',
            ...(idempotency ? { 'X-Idempotency-Key': idempotency } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(20000),
    });
    const data = await r.json();
    if (!r.ok) {
        const e = new Error('O Mercado Pago não concluiu a operação. Tente novamente ou verifique a conexão da loja.');
        e.status = 502;
        throw e;
    }
    return data;
}
const refreshing = new Map();
export async function tokenFor(storeId) {
    const s = await one('SELECT * FROM stores WHERE id=?', storeId);
    if (!s?.mp_token)
        throw Object.assign(new Error('Esta loja ainda precisa conectar o Mercado Pago.'), { status: 409 });
    if (s.mp_expires > Date.now() + 60000)
        return decrypt(s.mp_token);
    if (refreshing.has(storeId))
        return refreshing.get(storeId);
    const task = (async () => {
        const d = await mp('/oauth/token', '', {
            grant_type: 'refresh_token',
            client_id: process.env.MP_CLIENT_ID,
            client_secret: process.env.MP_CLIENT_SECRET,
            refresh_token: decrypt(s.mp_refresh),
        });
        await run('UPDATE stores SET mp_token=?,mp_refresh=?,mp_expires=? WHERE id=?', encrypt(d.access_token), encrypt(d.refresh_token), Date.now() + d.expires_in * 1000, storeId);
        return d.access_token;
    })();
    refreshing.set(storeId, task);
    try {
        return await task;
    }
    finally {
        refreshing.delete(storeId);
    }
}
export async function createPayment(o, user, cpf) {
    if (demo)
        return {};
    const token = await tokenFor(o.store_id);
    // Persist the exact encrypted payload before the network call. A timeout or retry
    // must reuse both the original idempotency key and the identical request body.
    let saved = await one('SELECT payload FROM payment_requests WHERE order_id=?', o.id);
    if (!saved) {
        const payload = {
            transaction_amount: o.total / 100,
            application_fee: o.fee / 100,
            description: 'Mercaz • pedido ' + o.id,
            payment_method_id: 'pix',
            external_reference: o.id,
            date_of_expiration: new Date(Date.parse(o.created.includes('T') ? o.created : o.created + 'Z') + 30 * 60000).toISOString(),
            notification_url: process.env.APP_URL + '/api/payments/webhook',
            payer: {
                email: user.email,
                first_name: user.name,
                identification: { type: 'CPF', number: cpf },
            },
        };
        await run('INSERT OR IGNORE INTO payment_requests VALUES(?,?)', o.id, encrypt(JSON.stringify(payload)));
        saved = await one('SELECT payload FROM payment_requests WHERE order_id=?', o.id);
    }
    const d = await mp('/v1/payments', token, JSON.parse(decrypt(saved.payload)), 'POST', o.id);
    await transaction(async () => {
        await run('UPDATE orders SET payment_id=?,payment_data=? WHERE id=?', String(d.id), JSON.stringify(d.point_of_interaction?.transaction_data || {}), o.id);
        await run('DELETE FROM payment_requests WHERE order_id=?', o.id);
    });
    await applyPayment(o, d);
    return d;
}
export async function applyPayment(o, d) {
    if (String(d.external_reference) !== o.id ||
        Math.round(Number(d.transaction_amount) * 100) !== o.total ||
        d.currency_id !== 'BRL')
        throw Error('Pagamento não corresponde ao pedido.');
    await transaction(async () => {
    const current = await lockOrder(o.id);
    if (d.status === 'approved' && current.status === 'pending')
        await transaction(async () => await status(o.id, 'confirmed'));
    if (['cancelled', 'rejected'].includes(d.status) &&
        current.status === 'pending')
        await release(o.id, 'cancelled');
    if (d.status === 'refunded' && current.status !== 'refunded')
        await release(o.id, 'refunded');
    });
}
export async function syncPayment(o) {
    if (demo || !o.payment_id)
        return;
    const d = await mp('/v1/payments/' + o.payment_id, await tokenFor(o.store_id), null, 'GET');
    await applyPayment(o, d);
}
export async function cancelPayment(o) {
    if (demo) {
        await release(o.id, 'cancelled');
        return;
    }
    if (!o.payment_id)
        throw Object.assign(new Error('Verifique ou gere o Pix antes de cancelar; uma tentativa anterior pode estar sendo processada.'), { status: 409 });
    await syncPayment(o);
    if ((await one('SELECT status FROM orders WHERE id=?', o.id)).status !== 'pending')
        throw Object.assign(new Error('O pagamento já foi atualizado. Recarregue o pedido.'), { status: 409 });
    const d = await mp('/v1/payments/' + o.payment_id, await tokenFor(o.store_id), { status: 'cancelled' }, 'PUT');
    await applyPayment(o, d);
}
export async function refundPayment(o) {
    if (!demo) {
        await mp(`/v1/payments/${o.payment_id}/refunds`, await tokenFor(o.store_id), {}, 'POST', 'refund-' + o.id);
        await syncPayment(o);
    }
    else
        await release(o.id, 'refunded');
}
export function validSignature(req) {
    const parts = Object.fromEntries(String(req.headers['x-signature'] || '')
        .split(',')
        .map((x) => x.trim().split('=')));
    const id = String(req.query['data.id'] || '').toLowerCase(), requestId = req.headers['x-request-id'];
    if (!parts.ts ||
        !parts.v1 ||
        !id ||
        !requestId ||
        !process.env.MP_WEBHOOK_SECRET)
        return false;
    const ts = Number(parts.ts);
    const millis = ts < 1e12 ? ts * 1000 : ts;
    if (Math.abs(Date.now() - millis) > 10 * 60000)
        return false;
    const expected = createHmac('sha256', process.env.MP_WEBHOOK_SECRET)
        .update(`id:${id};request-id:${requestId};ts:${parts.ts};`)
        .digest();
    const actual = Buffer.from(parts.v1, 'hex');
    return actual.length === expected.length && timingSafeEqual(expected, actual);
}
let reconciling = false;
export async function reconcile() {
    if (reconciling)
        return;
    reconciling = true;
    try {
        for (const o of await all("SELECT * FROM orders WHERE status='pending' OR (payment_id IS NOT NULL AND status NOT IN ('cancelled','refunded'))")) {
            try {
                if (!o.payment_id && !demo) {
                    const saved = await one('SELECT payload FROM payment_requests WHERE order_id=?', o.id);
                    if (saved) {
                        const payload = JSON.parse(decrypt(saved.payload));
                        await createPayment(o, { email: payload.payer.email, name: payload.payer.first_name }, payload.payer.identification.number);
                    }
                    else {
                        const age = Date.now() - Date.parse(o.created.includes('T') ? o.created : o.created + 'Z');
                        if (age > 40 * 60000) {
                            await release(o.id, 'cancelled');
                            continue;
                        }
                    }
                }
                const current = await one('SELECT * FROM orders WHERE id=?', o.id);
                await syncPayment(current);
                if (current.status === 'pending' &&
                    Date.now() - Date.parse(o.created.includes('T') ? o.created : o.created + 'Z') > 40 * 60000)
                    await cancelPayment(await one('SELECT * FROM orders WHERE id=?', o.id));
            }
            catch (e) {
                console.error('Reconciliação pendente:', o.id, e.message);
            }
        }
        await run('DELETE FROM sessions WHERE expires<?', Date.now());
        await run('DELETE FROM oauth WHERE expires<?', Date.now());
    }
    finally {
        reconciling = false;
    }
}

