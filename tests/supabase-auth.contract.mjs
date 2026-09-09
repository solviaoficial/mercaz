import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
// This suite is run by test-postgres.mjs with the PostgreSQL test driver.
if(!process.env.DATABASE_URL) throw Error('Run this suite with npm run test:postgres');
const dir=mkdtempSync(path.join(tmpdir(),'mercaz-auth-'));
Object.assign(process.env,{DATA_DIR:dir,NO_LISTEN:'true',AUTH_PROVIDER:'supabase',SUPABASE_URL:'https://auth-test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',GOOGLE_AUTH_ENABLED:'true',SEED_DEMO:'false',PAYMENT_MODE:'demo'});
const rawFetch=globalThis.fetch;
const id=randomUUID();
let verifiedUser={id,email:'cliente@example.test',email_confirmed_at:new Date().toISOString(),user_metadata:{name:'Cliente Google',role:'admin'},app_metadata:{provider:'google'},aud:'authenticated',created_at:new Date().toISOString()};
const token=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600,iat:Math.floor(Date.now()/1000),session_id:randomUUID()})).toString('base64url')+'.signature';
const requests=[];
globalThis.fetch=async(input,init={})=>{
  const u=new URL(typeof input==='string'?input:input.url||String(input));
  if(u.origin!=='https://auth-test.supabase.co') return rawFetch(input,init);
  const body=init.body?JSON.parse(init.body):{};
  requests.push({path:u.pathname,query:u.search,body,headers:init.headers});
  const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
  if(u.pathname.endsWith('/signup')) return json({user:{...verifiedUser,email_confirmed_at:null}});
  if(u.pathname.endsWith('/token')) {
    if(u.searchParams.get('grant_type')==='pkce') return json({error:'invalid_grant',error_description:'invalid verifier'},400);
    if(body.password!=='SenhaValida2026!') return json({error:'invalid_grant',error_description:'invalid credentials'},400);
    return json({access_token:token,refresh_token:'refresh-test',expires_in:3600,token_type:'bearer',user:verifiedUser});
  }
  if(u.pathname.endsWith('/user')) {
    const authorization=new Headers(init.headers).get('authorization');
    if(authorization!=='Bearer '+token) return json({error:'invalid_token',message:'Invalid JWT'},401);
    return json(verifiedUser);
  }
  if(u.pathname.endsWith('/recover') || u.pathname.endsWith('/logout')) return json({});
  throw Error('Unexpected auth endpoint '+u.pathname);
};
const {app}=await import('../server/index.mjs');
const {db,run,one}=await import('../server/db.mjs');
const {safeNext}=await import('../server/auth.mjs');
await run('INSERT INTO auth.users(id) VALUES(?)',id);
const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
const base='http://127.0.0.1:'+server.address().port;
let cookie='';
async function call(endpoint,body,session=cookie) {
 const response=await rawFetch(base+'/api'+endpoint,{method:body?'POST':'GET',redirect:'manual',headers:{'X-Mercaz-Client':'web','Content-Type':'application/json',Cookie:session},...(body?{body:JSON.stringify(body)}:{})});
 const cookies=response.headers.getSetCookie();
 const data=response.headers.get('content-type')?.includes('application/json')?await response.json():null;
 return {response,data,cookies};
}
after(async()=>{globalThis.fetch=rawFetch;await new Promise(r=>server.close(r));await db.close();rmSync(dir,{recursive:true,force:true});});
test('Supabase Auth: confirmação, sessão validada, Google PKCE e recuperação',async t=>{
 await t.test('cadastro aguarda confirmação e não cria sessão local',async()=>{
  const r=await call('/auth/register',{name:'Cliente',email:'cliente@example.test',password:'SenhaValida2026!'});
  assert.equal(r.response.status,201);assert.equal(r.data.confirmationRequired,true);assert.equal(await one('SELECT * FROM users WHERE supabase_id=?',id),undefined);
 });
 await t.test('credenciais inválidas são recusadas',async()=>{assert.equal((await call('/auth/login',{email:'cliente@example.test',password:'errada'})).response.status,401);});
 await t.test('login usa cookies HttpOnly e vincula UUID verificado',async()=>{
  const r=await call('/auth/login',{email:'cliente@example.test',password:'SenhaValida2026!'});
  assert.equal(r.response.status,200);assert.equal(r.data.name,'Cliente Google');
  assert.ok(r.cookies.some(v=>v.includes('HttpOnly') && v.includes('SameSite=Lax')));
  cookie=r.cookies.map(v=>v.split(';')[0]).join('; ');
  assert.equal((await one('SELECT * FROM users WHERE id=?',r.data.id)).supabase_id,id);
  assert.equal((await call('/admin/reports')).response.status,403);
 });
 await t.test('conta é verificada no Supabase a cada requisição e email é atualizado',async()=>{
  verifiedUser={...verifiedUser,email:'atualizado@example.test'};
  const r=await call('/bootstrap');assert.equal(r.data.user.email,verifiedUser.email);
  assert.equal((await call('/orders',null,'mercaz_session=falso')).response.status,401);
 });
 await t.test('Google usa PKCE S256 e callback apenas do site',async()=>{
  const r=await call('/auth/google?next=https://evil.example',null,'');
  assert.equal(r.response.status,302);
  const u=new URL(r.response.headers.get('location'));assert.equal(u.hostname,'auth-test.supabase.co');
  assert.equal(u.searchParams.get('provider'),'google');assert.equal(u.searchParams.get('code_challenge_method'),'s256');assert.ok(u.searchParams.get('code_challenge'));
  assert.ok(u.searchParams.get('redirect_to').startsWith('http://localhost:3000/api/auth/callback'));
  assert.ok(r.cookies.some(v=>v.includes('code-verifier') && v.includes('HttpOnly')));
  for(const next of ['//evil.example','/\\evil.example','https://evil.example','/\n/evil']) assert.equal(safeNext(next),'/conta');
 });
 await t.test('callback falso não autentica',async()=>{
  const r=await call('/auth/callback?code=inventado',null,'');assert.equal(r.response.headers.get('location'),'/entrar?auth_error=1');
 });
 await t.test('recuperação não enumera usuários e redefinição exige sessão',async()=>{
  const r=await call('/auth/recover',{email:'ausente@example.test'},'');assert.equal(r.response.status,200);assert.match(r.data.message,/Se houver/);
  assert.equal((await call('/auth/reset',{password:'NovaSenhaValida2026!'},'')).response.status,401);
  assert.equal((await call('/auth/reset',{password:'NovaSenhaValida2026!'})).response.status,200);
  assert.ok(requests.some(r=>r.path.endsWith('/user') && r.body.password==='NovaSenhaValida2026!'));
 });
});
