const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load({user='user',rpcError=null}={}){
 const calls=[],stored=new Map([['@arivly_push_token','ExpoPushToken[synthetic]']]);const exports={};
 const modules={
 '@react-native-async-storage/async-storage':{default:{getItem:async k=>stored.get(k),setItem:async(k,v)=>stored.set(k,v),removeItem:async k=>stored.delete(k)}},
 '@/lib/supabase':{supabase:{auth:{getSession:async()=>({data:{session:{user:{id:user}}}})},rpc:async(name,body)=>{calls.push({name,body});return {error:rpcError}}}}
 };
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/pushDevice.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,require:n=>modules[n]});return {exports,calls,stored};
}
test('late token result after logout/account switch cannot register against old user',async()=>{
 const f=load({user:'other'});await f.exports.savePushDevice('ExpoPushToken[new]','user');assert.equal(f.calls.length,0);
});
test('push registration failure remains retryable and does not replace stored token',async()=>{
 const f=load({rpcError:Error('offline')});await assert.rejects(f.exports.savePushDevice('ExpoPushToken[new]','user'));assert.equal(f.stored.get('@arivly_push_token'),'ExpoPushToken[synthetic]');
});
test('logout unregisters only this device before clearing local record',async()=>{
 const f=load();await f.exports.removePushDevice();assert.equal(f.calls[0].name,'unregister_push_device');assert.equal(f.calls[0].body.p_token,'ExpoPushToken[synthetic]');assert.equal(f.stored.size,0);
});
