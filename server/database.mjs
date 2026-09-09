import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
export const postgres = !!process.env.DATABASE_URL;
export const dataDir = path.resolve(process.env.DATA_DIR || 'data');
mkdirSync(path.join(dataDir, 'uploads'), { recursive: true });
let pool, sqlite;
if (postgres) {
  const { default: pg } = await import('pg');
  pg.types.setTypeParser(20, v => { const n = Number(v); if (!Number.isSafeInteger(n)) throw Error('Database integer overflow'); return n; });
  pg.types.setTypeParser(1700, Number);
  pg.types.setTypeParser(1184, v => new Date(v).toISOString());
  const connection = new URL(process.env.DATABASE_URL);
  for (const key of ['sslmode','sslcert','sslkey','sslrootcert']) connection.searchParams.delete(key);
  pool = new pg.Pool({ connectionString: connection.toString(), max: Number(process.env.DB_POOL_SIZE || 5),
    connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000,
    ssl: { rejectUnauthorized: true, ...(process.env.DATABASE_CA_CERT ? { ca: process.env.DATABASE_CA_CERT.replace(/\\n/g,'\n') } : {}) },
    options: '-c search_path=mercaz,public -c timezone=UTC -c statement_timeout=15000',
  });
  pool.on('error', () => console.error('Conexão de banco interrompida; nova conexão será criada.'));
  const check = await pool.query("SELECT to_regclass('mercaz.users') AS users");
  if (!check.rows[0].users) { await pool.end(); throw Error('Execute a migração supabase/migrations/202609090001_mercaz.sql antes de iniciar.'); }
} else {
  ({db: sqlite} = await import('./sqlite.mjs'));
}
const context = new AsyncLocalStorage();
let tail = Promise.resolve();
async function sqliteLock(fn) {
  const previous = tail; let done; tail = new Promise(r => { done = r; });
  await previous;
  try { return await fn(); } finally { done(); }
}
export function sqlForPostgres(sql) {
  let i=0;
  let result=sql.replace(/'(?:''|[^'])*'|"(?:""|[^"])*"|\?/g, m=>m==='?'?'$'+(++i):m);
  if (/^INSERT OR IGNORE /i.test(result)) result=result.replace(/^INSERT OR IGNORE /i,'INSERT ')+' ON CONFLICT DO NOTHING';
  return result;
}
async function query(sql,args,write=false) {
  const active=context.getStore();
  if(postgres) {
    let statement=sqlForPostgres(sql);
    if(write && /^INSERT /i.test(statement) && !/\bRETURNING\b/i.test(statement)) statement+=' RETURNING *';
    const r=await (active?.client || pool).query(statement,args);
    return write ? {changes:r.rowCount,lastInsertRowid:r.rows[0]?.id} : r.rows;
  }
  const exec=()=> write ? sqlite.prepare(sql).run(...args) : sqlite.prepare(sql).all(...args);
  return active ? exec() : sqliteLock(exec);
}
export const all=(sql,...args)=>query(sql,args);
export const one=async(sql,...args)=>(await all(sql,...args))[0];
export const run=(sql,...args)=>query(sql,args,true);
export const db={close:async()=>{if(pool)await pool.end();else sqlite.close();}};
export async function transaction(fn) {
  if(context.getStore()) return fn();
  const execute=async()=>{
    const client=postgres?await pool.connect():null;
    const exec=sql=>client?client.query(sql):sqlite.exec(sql);
    try {
      await exec(postgres?'BEGIN':'BEGIN IMMEDIATE');
      const value=await context.run({client},fn);
      await exec('COMMIT'); return value;
    } catch(e) {try{await exec('ROLLBACK');}catch{} throw e;}
    finally{client?.release();}
  };
  return postgres?execute():sqliteLock(execute);
}
export async function lockOrder(id) {
  if(!context.getStore()) throw Error('Order locks require a transaction');
  return one('SELECT * FROM orders WHERE id=?'+(postgres?' FOR UPDATE':''),id);
}
export async function lockCheckout(userId) {
  if(postgres) await one('SELECT pg_advisory_xact_lock(?)',userId);
}
export const hash=s=>createHash('sha256').update(s).digest('hex');
export function passwordHash(p) { const salt=randomBytes(16).toString('hex'); return salt+':'+scryptSync(p,salt,64).toString('hex'); }
export function passwordOK(p,h) { const [s,k]=(h||'').split(':'); if(!s || !/^[a-f0-9]{128}$/i.test(k||'')) return false; return timingSafeEqual(Buffer.from(k,'hex'),scryptSync(p,s,64)); }
export async function notify(user,text,href) { await run('INSERT INTO notifications(user_id,text,href) VALUES(?,?,?)',user,text,href); }
export async function status(id,state) {
  await run('UPDATE orders SET status=?,updated=CURRENT_TIMESTAMP WHERE id=?',state,id);
  await run('INSERT INTO events(order_id,status) VALUES(?,?)',id,state);
  const o=await one('SELECT * FROM orders WHERE id=?',id);
  await notify(o.user_id,'Seu pedido '+id.slice(-6)+' foi atualizado.','/pedidos/'+id);
}
export async function release(id,state) {
  return transaction(async()=>{
    const o=await lockOrder(id);
    if(!o || ['cancelled','refunded'].includes(o.status)) return;
    for(const i of await all('SELECT * FROM order_items WHERE order_id=?',id)) await run('UPDATE products SET stock=stock+? WHERE id=?',i.qty,i.product_id);
    await status(id,state);
  });
}
export const publicStore=s=>s?{id:s.id,name:s.name,description:s.description,prep_days:s.prep_days,shipping:s.shipping,shipping_days:s.shipping_days,paused:s.paused,days:s.days,created:s.created}:null;
export const publicUser=async u=>u?{id:u.id,name:u.name,email:u.email,address:JSON.parse(u.address),seller:!!await one('SELECT id FROM stores WHERE user_id=?',u.id)}:null;
