const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
const {PGlite}=require('@electric-sql/pglite');
const model={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/homePageContent.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:model,URL,structuredClone,Date,Math});

test('CMS content permits text, safe links and images, and rejects executable URL forms',()=>{
 for(const url of ['javascript:alert(1)','data:text/html,x','//evil.test','/\\evil.test','https://user:secret@example.com/','https://ex\nample.com']) assert.equal(model.safeHomeLink(url),'');
 assert.equal(model.safeHomeLink('/post'),'/post');
 assert.equal(model.safeHomeLink('https://example.com/'),'https://example.com/');
 assert.equal(model.safeHomeImage('javascript:x'),'');
 assert.equal(model.safeHomeImage('https://example.com/photo.webp'),'https://example.com/photo.webp');
 const source={announcement:'Draft',footerText:'Footer',sections:[{...model.newHomeBlock('text','one'),title:'<script>alert(1)</script>',buttonHref:'javascript:alert(1)'},{...model.newHomeBlock('text','one')},{id:'two',type:'script'},{...model.newHomeBlock('promo','three'),enabled:false}]};
 const result=model.normalizeHomePage(source);
 assert.equal(result.sections.length,2);
 assert.equal(result.sections[0].title,'<script>alert(1)</script>'); // React renders plain text.
 assert.equal(result.sections[0].buttonHref,'');
 assert.equal(result.sections[1].enabled,false);
 assert.equal(model.normalizeHomePage({sections:[]}).sections.length,0); // intentional empty page isn't reset
 assert.equal(model.normalizeHomePage({}).sections[0].type,'hero');
});

test('PostgreSQL CMS: drafts stay private; admin save/publish, conflicts and storage permissions',async()=>{
 const db=new PGlite();
 const admin='00000000-0000-4000-8000-000000000001', normal='00000000-0000-4000-8000-000000000002';
 const doc=JSON.stringify(model.DEFAULT_HOME_PAGE);
 const login=async(role,user='')=>{await db.exec('reset role');await db.query("select set_config('test.uid',$1,false)",[user]);await db.exec(`set role ${role}`);};
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
   create schema auth;create schema storage;
   grant usage on schema public,auth,storage to anon,authenticated,service_role;
   create table auth.users(id uuid primary key);
   insert into auth.users values('${admin}'),('${normal}');
   create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
   create function public.is_super_admin() returns boolean language sql as $$select coalesce(auth.uid()='${admin}'::uuid,false)$$;
   create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
   create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
   alter table storage.objects enable row level security;
   grant select,insert,update,delete on storage.objects to anon,authenticated;
   create function storage.foldername(name text) returns text[] language sql as $$select string_to_array(name,'/')$$;`);
  await db.exec(fs.readFileSync('supabase/migrations/20261106010000_web_home_cms.sql','utf8'));
  await login('anon');
  assert.deepEqual((await db.query('select state from web_home_pages')).rows.map(r=>r.state),['published']);
  await assert.rejects(db.query('select updated_by from web_home_pages'),/permission denied/);
  await assert.rejects(db.query('select save_web_home_draft($1,0)',[doc]),/permission denied/);
  await login('authenticated',normal);
  assert.equal((await db.query("select state from web_home_pages where state='draft'")).rows.length,0);
  await assert.rejects(db.query('select save_web_home_draft($1,0)',[doc]),/ADMIN_REQUIRED/);
  await assert.rejects(db.exec("update web_home_pages set content='{}'"),/permission denied/);
  await assert.rejects(db.exec("insert into storage.objects(bucket_id,name) values('web-content','anything/photo.png')"),/row-level security/);
  await login('authenticated',admin);
  assert.equal((await db.query('select state from web_home_pages')).rows.length,2);
  assert.equal((await db.query('select save_web_home_draft($1,0) revision',[doc])).rows[0].revision,1);
  await assert.rejects(db.query('select save_web_home_draft($1,0)',[doc]),/CONTENT_CONFLICT/);
  await assert.rejects(db.query('select publish_web_home_draft(0)'),/CONTENT_CONFLICT/);
  await login('anon');
  assert.deepEqual((await db.query("select content from web_home_pages where state='published'")).rows[0].content,{});
  await login('authenticated',admin);
  await db.query('select publish_web_home_draft(1)');
  await db.query("insert into storage.objects(bucket_id,name) values('web-content',$1)",[`${admin}/photo.png`]);
  await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values('web-content',$1)",[`${normal}/wrong.png`]),/row-level security/);
  await assert.rejects(db.query('select save_web_home_draft($1,1)',[JSON.stringify({schemaVersion:1,sections:'bad'})]),/INVALID_CONTENT/);
  await login('anon');
  assert.equal((await db.query("select content from web_home_pages where state='published'")).rows[0].content.sections[0].type,'hero');
  assert.equal((await db.query('select name from storage.objects')).rows.length,1);
  await login('authenticated',normal);
  await assert.rejects(db.query('select publish_web_home_draft(1)'),/ADMIN_REQUIRED/);
  await login('service_role');
  assert.equal((await db.query('select state from web_home_pages')).rows.length,2);
 } finally {await db.close();}
});
