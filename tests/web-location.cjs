const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const ts=require('typescript');
const cache={};
function load(name){
 if(cache[name])return cache[name];
 const exports={};cache[name]=exports;
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(`lib/${name}.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,URL,structuredClone,Date,Math,require:dependency=>dependency==='@/lib/supabase'?{supabase:{}}:load(dependency.replace('./',''))});
 return exports;
}
const location=load('webLocationListings');
const content=load('homePageContent');
const job=(id,latitude,longitude,extra={})=>({id,title:'Камер',category:'Технологи',postType:'job',location:{latitude,longitude},...extra});

test('map excludes absent, empty, nonfinite and out-of-range coordinates; accepts legitimate zero and numeric strings',()=>{
 for(const pair of [[null,106],['',106],[true,106],[NaN,106],[91,106],[47,181]]) assert.equal(location.listingCoordinate(job('x',...pair)),null);
 assert.equal(location.listingCoordinate(job('x','47.9','106.9')).latitude,47.9);
 assert.equal(location.listingCoordinate(job('x',0,0)).longitude,0);
 assert.equal(location.listingCoordinate(job('x',null,null,{latitude:48,longitude:107})).latitude,48);
});
test('nearby list filters the radius and sorts distances without changing the source or fabricating coordinates',()=>{
 const origin={latitude:47.9184,longitude:106.9177};
 const jobs=[job('far',48,107),job('near',47.92,106.92),job('same',47.9184,106.9177),job('missing',null,null),job('expired',47.9184,106.9177,{listing_expires_at:'2020-01-01'}),job('inactive',47.9184,106.9177,{isActive:false}),job('deleted',47.9184,106.9177,{deleted_at:'2026-01-01'})];
 assert.deepEqual(Array.from(location.locatedListings(jobs,{origin,radiusKm:1}),row=>row.job.id),['same','near']);
 assert.equal(location.locatedListings(jobs).length,3);
 assert.equal(jobs[0].id,'far');
 assert.equal(location.locatedListings(jobs,{query:'Байшин'}).length,0);
 assert.equal(location.locatedListings(jobs,{category:'Өөр'}).length,0);
 assert.ok(Math.abs(location.distanceKm({latitude:0,longitude:0},{latitude:0,longitude:1})-111.195)<.01);
});
test('legacy CMS drafts keep their content and get editable header defaults; unsafe header URLs are excluded',()=>{
 const previous={schemaVersion:1,announcement:'Миний бичиг',footerText:'Хөл',sections:[{...content.newHomeBlock('hero','custom'),title:'Миний гарчиг'}]};
 const upgraded=content.normalizeHomePage(previous);
 assert.equal(upgraded.sections[0].title,'Миний гарчиг');
 assert.equal(upgraded.announcement,'Миний бичиг');
 assert.equal(upgraded.header.links[1].href,'/#locations');
 const edited=content.normalizeHomePage({...previous,header:{logoUrl:'javascript:x',logoAlt:'Лого',links:[{id:'bad',label:'Муу',href:'javascript:x'},{id:'ok',label:'Нөхцөл',href:'/help/terms',enabled:false}]}});
 assert.equal(edited.header.logoUrl,'/logo.png');
 assert.equal(edited.header.links.length,1);
 assert.equal(edited.header.links[0].enabled,false);
 assert.equal(content.normalizeHomePage({...previous,header:{links:[]}}).header.links.length,0);
});
