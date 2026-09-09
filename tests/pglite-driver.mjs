// Test-only pg Pool substitute backed by actual PostgreSQL WASM, without a Docker dependency.
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
class Pool {
  constructor() {
    this.db=new PGlite(); this.tail=Promise.resolve();
    this.ready=(async()=>{
      await this.db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);');
      await this.db.exec(readFileSync(new URL('../supabase/migrations/202609090001_mercaz.sql',import.meta.url),'utf8'));
      await this.db.exec('SET search_path=mercaz,public; SET timezone=UTC;');
    })();
  }
  on(){}
  async connect(){
    await this.ready; const previous=this.tail; let release; this.tail=new Promise(r=>release=r); await previous;
    return {query:(sql,args)=>this.execute(sql,args),release};
  }
  async execute(sql,args) {
    const result=await this.db.query(sql,args);
    return {rows:result.rows.map(row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,v instanceof Date?v.toISOString():typeof v==='bigint'?Number(v):v]))),rowCount:result.affectedRows || result.rows.length};
  }
  async query(sql,args){const client=await this.connect();try{return await client.query(sql,args);}finally{client.release();}}
  async end(){await this.tail;await this.db.close();}
}
export default {Pool,types:{setTypeParser(){}}};
