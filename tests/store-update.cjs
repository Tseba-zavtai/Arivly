const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
function load({os='ios',current='1.0.1',store='1.0.2',minimum='15.0',bundle='mn.tureestei.app',code=27}={}){
 const exports={};const modules={react:{},'react/jsx-runtime':{},'react-native':{Platform:{OS:os,Version:'18.0'}},'expo-application':{applicationId:'mn.tureestei.app',nativeApplicationVersion:current},expo:{requireOptionalNativeModule:()=>({availableVersionCode:async()=>code})},'@/contexts/AppLockContext':{},'@/contexts/AuthContext':{}};
 const source=fs.readFileSync('components/StoreUpdatePrompt.tsx','utf8')+'\nexport const checkStore=findStoreUpdate;export const compare=isNewer;';
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>modules[n],fetch:async()=>({ok:true,json:async()=>({results:[{bundleId:bundle,version:store,minimumOsVersion:minimum}]})})});return exports;
}
test('iOS public newer version requires update',async()=>assert.equal((await load().checkStore(new AbortController().signal)).version,'1.0.2'));
test('iOS equal or newer installed version is not blocked',async()=>{
 for(const current of ['1.0.2','1.0.3'])assert.equal(await load({current}).checkStore(new AbortController().signal),null);
});
test('iOS incompatible OS or other bundle cannot force update',async()=>{
 for(const args of [{minimum:'19.0'},{bundle:'other'}])assert.equal(await load(args).checkStore(new AbortController().signal),null);
});
test('Android uses available Play version code and ignores unavailable update',async()=>{
 assert.equal((await load({os:'android'}).checkStore(new AbortController().signal)).version,'27');assert.equal(await load({os:'android',code:null}).checkStore(new AbortController().signal),null);
});
test('version comparison is numeric and rejects malformed store versions',()=>{
 const {compare}=load();assert.equal(compare('1.0.10','1.0.9'),true);assert.equal(compare('1.0','1.0.0'),false);assert.equal(compare('latest','1.0'),false);
});
