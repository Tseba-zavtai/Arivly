const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
async function run(provider,{state='pending',attempts=1,http=200,network=false}={}){
 let handler;const writes=[],calls=[];
 const job={id:'queue',user_id:'user',token:'ExpoPushToken[synthetic]',state,attempts,ticket_id:'ticket',title:'Test',body:'Test',url:'/rental-requests?requestId=test'};
 const db={rpc:async()=>({data:[job]}),from(table){let patch;const chain={update(value){patch=value;return chain},delete(){patch={deleted:true};return chain},eq(){return chain},then(resolve){writes.push({table,...patch});return Promise.resolve({}).then(resolve)}};return chain}};
 const source=fs.readFileSync('supabase/functions/rental-push-worker/index.ts','utf8').replace(/^import .*\r?\n/gm,'');
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{serve:fn=>handler=fn,createClient:()=>db,Deno:{env:{get:()=> 'test'}},fetch:async(url,opts)=>{calls.push({url,body:JSON.parse(opts.body)});if(network)throw Error('offline');return new Response(JSON.stringify(provider),{status:http})},AbortSignal,Date,Response,console});
 const response=await handler(new Request('https://test.invalid',{method:'POST',body:JSON.stringify({token:'untrusted-recipient'})}));
 return {writes,calls,status:response.status};
}
test('single/array Expo tickets are retained for receipt verification, not marked delivered',async()=>{
 for(const data of [{status:'ok',id:'ticket'},[{status:'ok',id:'ticket'}]]){
 const r=await run({data});assert.equal(r.writes.at(-1).state,'ticket');assert.equal(r.writes.at(-1).ticket_id,'ticket');
 assert.equal(r.calls[0].body.to,'ExpoPushToken[synthetic]');assert.notEqual(r.calls[0].body.to,'untrusted-recipient');
 }
});
test('accepted provider receipt completes queue entry',async()=>{
 const r=await run({data:{ticket:{status:'ok'}}},{state:'ticket'});
 assert.match(r.calls[0].url,/getReceipts$/);assert.equal(r.writes.at(-1).state,'receipt_ok');
});
test('unavailable receipts retry without re-sending the notification',async()=>{
 const r=await run({data:{}},{state:'ticket'});assert.equal(r.writes.at(-1).state,'ticket');assert.match(r.calls[0].url,/getReceipts$/);
});
test('network error is retained with bounded retry',async()=>{
 const r=await run({}, {network:true});assert.equal(r.writes.at(-1).state,'pending');assert.equal(r.writes.at(-1).leased_until,null);assert.ok(r.writes.at(-1).next_attempt_at);
});
test('retry exhaustion stops instead of looping forever',async()=>{
 const r=await run({}, {network:true,attempts:8});assert.equal(r.writes.at(-1).state,'failed');
});
test('invalid device is removed and legacy token cleared',async()=>{
 const r=await run({data:{status:'error',details:{error:'DeviceNotRegistered'}}});
 assert.equal(r.writes.find(w=>w.table==='push_devices').deleted,true);assert.equal(r.writes.find(w=>w.table==='users').expo_push_token,null);assert.equal(r.writes.at(-1).state,'dead');
});
test('provider HTTP failure does not report success',async()=>{
 const r=await run({data:{status:'ok',id:'ticket'}},{http:503});assert.equal(r.writes.at(-1).state,'pending');
});
