import { createServerClient } from '@supabase/ssr';
import { one, run, publicUser, postgres } from './db.mjs';
export const supabaseAuth = process.env.AUTH_PROVIDER === 'supabase';
const origin = new URL(process.env.APP_URL || 'http://localhost:3000').origin;
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
if (supabaseAuth && (!postgres || !url?.startsWith('https://') || !key))
  throw Error('Supabase exige DATABASE_URL, SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY.');
if (supabaseAuth && process.env.SEED_DEMO === 'true')
  throw Error('Desative SEED_DEMO para usar o Supabase Auth.');
const failure=(message,status=400)=>{throw Object.assign(Error(message),{status});};
function field(v,min,max) { if(typeof v!=='string' || v.length<min || v.length>max) failure('Verifique os campos preenchidos.'); return v; }
export function safeNext(value) {
  if(typeof value!=='string' || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return '/conta';
  const target = new URL(value,origin);
  return target.origin === origin ? target.pathname+target.search : '/conta';
}
export function authClient(req,res) {
  const jar=new Map((req.headers.cookie||'').split(';').flatMap(part=>{
    const i=part.indexOf('='); if(i<0)return [];
    try{return [[part.slice(0,i).trim(),decodeURIComponent(part.slice(i+1))]];}catch{return [];}
  }));
  return createServerClient(url,key,{
    cookieOptions:{httpOnly:true,secure:origin.startsWith('https://'),sameSite:'lax',path:'/'},
    global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(15000)})},
    cookies:{
      getAll:()=>Array.from(jar,([name,value])=>({name,value})),
      setAll:entries=>{for(const {name,value,options} of entries){
        jar.set(name,value);
        const {maxAge,...rest}=options;
        res.cookie(name,value,{...rest,...(maxAge===undefined?{}:{maxAge:maxAge*1000}),httpOnly:true,secure:origin.startsWith('https://'),sameSite:'lax',path:'/'});
      }},
    },
  });
}
export async function syncAuthUser(user) {
  if(!user?.id || !user.email || !user.email_confirmed_at) failure('Confirme seu e-mail antes de entrar.',401);
  const existing=await one('SELECT * FROM users WHERE supabase_id=?',user.id);
  const email=user.email.toLowerCase();
  if(existing) {
    if(existing.email!==email) await run('UPDATE users SET email=? WHERE id=?',email,existing.id);
    return {...existing,email};
  }
  if(await one('SELECT id FROM users WHERE lower(email)=?',email)) failure('Esta conta precisa ser vinculada durante a migração. Entre em contato com o suporte.',409);
  const name=String(user.user_metadata?.full_name || user.user_metadata?.name || email.split('@')[0]).trim().slice(0,80) || 'Cliente';
  await run("INSERT INTO users(name,email,password,supabase_id) VALUES(?,?,'',?) ON CONFLICT(supabase_id) DO NOTHING",name,email,user.id);
  return one('SELECT * FROM users WHERE supabase_id=?',user.id);
}
export async function supabaseSession(req,res,next) {
  req.sb=authClient(req,res);
  const {data,error}=await req.sb.auth.getUser();
  if(error && !['AuthSessionMissingError','AuthApiError'].includes(error.name)) failure('A autenticação está temporariamente indisponível.',503);
  req.supabaseUser=data.user || null;
  req.user=data.user?await syncAuthUser(data.user):null;
  next();
}
export function installAuth(app,authLimit) {
  if(!supabaseAuth) return;
  app.post('/api/auth/register',authLimit,async(req,res)=>{
    const name=field(req.body.name,2,80).trim(),email=field(req.body.email,5,180).trim().toLowerCase(),password=field(req.body.password,12,128);
    const {data,error}=await req.sb.auth.signUp({email,password,options:{data:{name},emailRedirectTo:origin+'/api/auth/callback'}});
    if(error) failure(error.status===429?'Aguarde alguns minutos antes de tentar novamente.':'Não foi possível cadastrar. Verifique o e-mail e use uma senha de pelo menos 12 caracteres.');
    if(!data.session) return res.status(201).json({confirmationRequired:true,message:'Confira seu e-mail para confirmar o cadastro.'});
    res.status(201).json(await publicUser(await syncAuthUser(data.user)));
  });
  app.post('/api/auth/login',authLimit,async(req,res)=>{
    const {data,error}=await req.sb.auth.signInWithPassword({email:field(req.body.email,3,180).trim(),password:field(req.body.password,1,128)});
    if(error) failure('E-mail ou senha incorretos, ou e-mail ainda não confirmado.',401);
    res.json(await publicUser(await syncAuthUser(data.user)));
  });
  app.post('/api/auth/logout',async(req,res)=>{
    const {error}=await req.sb.auth.signOut({scope:'local'});
    if(error) failure('Não foi possível encerrar a sessão. Tente novamente.',503);
    res.clearCookie('mercaz_session',{path:'/'});
    res.json({ok:true});
  });
  app.get('/api/auth/google',authLimit,async(req,res)=>{
    if(process.env.GOOGLE_AUTH_ENABLED!=='true') failure('O login com Google ainda não foi ativado.',503);
    const next=safeNext(req.query.next);
    const {data,error}=await req.sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:origin+'/api/auth/callback?next='+encodeURIComponent(next),skipBrowserRedirect:true}});
    if(error || !data.url) failure('Não foi possível iniciar o login com Google.',503);
    res.redirect(data.url);
  });
  app.get('/api/auth/callback',authLimit,async(req,res)=>{
    if(typeof req.query.code!=='string') return res.redirect('/entrar?auth_error=1');
    const {data,error}=await req.sb.auth.exchangeCodeForSession(req.query.code);
    if(error || !data.user) return res.redirect('/entrar?auth_error=1');
    await syncAuthUser(data.user);
    res.redirect(data.redirectType==='recovery'?'/entrar?mode=reset':safeNext(req.query.next));
  });
  app.post('/api/auth/recover',authLimit,async(req,res)=>{
    const email=field(req.body.email,5,180).trim();
    const {error}=await req.sb.auth.resetPasswordForEmail(email,{redirectTo:origin+'/api/auth/callback'});
    if(error?.status===429) failure('Aguarde alguns minutos antes de tentar novamente.',429);
    if(error && error.status>=500) failure('Não foi possível enviar o e-mail agora.',503);
    res.json({message:'Se houver uma conta com esse e-mail, você receberá um link para redefinir a senha. Abra o link neste navegador.'});
  });
  const changePassword=async(req,res)=>{
    if(!req.supabaseUser) failure('Abra o link de recuperação ou entre na sua conta.',401);
    const password=field(req.body.password,12,128);
    const {error}=await req.sb.auth.updateUser({password});
    if(error) failure('Não foi possível alterar a senha. Use uma senha nova com pelo menos 12 caracteres.');
    const {error:logoutError}=await req.sb.auth.signOut({scope:'global'});
    if(logoutError) failure('Senha alterada, mas não foi possível encerrar todas as sessões. Entre novamente.',503);
    res.json({ok:true,reauthenticate:true});
  };
  app.post('/api/auth/reset',authLimit,changePassword);
  app.post('/api/account/password',authLimit,changePassword);
}
