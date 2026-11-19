const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const ts=require('typescript');
async function run(ticket){
 let handler;
 const db={auth:{getUser:async()=>({data:{user:{id:'caller'}}})},from(table){
  const chain={select(){return chain},eq(){return chain},async maybeSingle(){
   return {data:table==='rental_requests'?{id:'request',requester_id:'caller',owner_id:'owner',job_id:'job'}:table==='users'?{expo_push_token:'ExpoPushToken[test]'}:{title:'Test listing'}};
  }};return chain;
 }};
 const source=fs.readFileSync('supabase/functions/send-rental-request-push/index.ts','utf8').replace(/^import .*\r?\n/gm,'');
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(js,{serve:fn=>handler=fn,createClient:()=>db,Deno:{env:{get:()=> 'test'}},fetch:async()=>new Response(JSON.stringify(ticket)),Response,console});
 const result=await handler(new Request('https://test.invalid',{method:'POST',headers:{Authorization:'Bearer test'},body:JSON.stringify({rentalRequestId:'request'})}));
 return {status:result.status,body:await result.json()};
}
test('push accepts single and array tickets',async()=>{
 for(const data of [{status:'ok',id:'ticket'},[{status:'ok',id:'ticket'}]]){
 const r=await run({data});assert.equal(r.status,200);assert.equal(r.body.ticketId,'ticket');
 }
});
test('push rejects error and missing tickets instead of reporting success',async()=>{
 for(const data of [{status:'error',message:'Device not registered'},null,{status:'ok'}]){
 const r=await run({data});assert.equal(r.status,502);assert.notEqual(r.body.delivered,true);
 }
});
