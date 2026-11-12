import { Buffer } from 'node:buffer';
import { KEYUTIL, KJUR } from 'npm:jsrsasign@11.1.5';
import { Environment } from 'npm:@apple/app-store-server-library@2.0.0';
import { SignJWT, importPKCS8 } from 'npm:jose@5.9.6';
import { AppleEdgeVerifier, EdgeCertificate, certificateDate } from '../supabase/functions/store-purchases/apple-edge-verifier.ts';

function assert(ok:unknown) { if (!ok) throw new Error('Assertion failed'); }
async function rejects(action:()=>Promise<unknown>) { let failed=false; try {await action();} catch {failed=true;} assert(failed); }
const root = KEYUTIL.generateKeypair('EC','secp256r1');
const intermediate = KEYUTIL.generateKeypair('EC','secp256r1');
const leaf = KEYUTIL.generateKeypair('EC','secp256r1');
function certificate(name:string, issuer:string, keys:any, signer:any, ca:boolean, oid?:string) {
  const ext:any[] = [{extname:'basicConstraints',cA:ca}];
  if (oid) {
    ext.push({extname:oid,extn:'0500'});
    ext.push({extname:'authorityInfoAccess',array:[{ocsp:'http://ocsp.apple.com/test'}]});
  }
  return new KJUR.asn1.x509.Certificate({version:3,serial:{int:1},sigalg:'SHA256withECDSA',
    issuer:{str:`/CN=${issuer}`},subject:{str:`/CN=${name}`},notbefore:'200101000000Z',notafter:'390101000000Z',
    sbjpubkey:keys.pubKeyObj,cakey:signer.prvKeyObj,ext}).getPEM();
}
const rootPem=certificate('root','root',root,root,true);
const intermediatePem=certificate('intermediate','root',intermediate,root,true,'1.2.840.113635.100.6.2.1');
const leafPem=certificate('leaf','intermediate',leaf,intermediate,false,'1.2.840.113635.100.6.11.1');
const der=(pem:string)=>Buffer.from(pem.replace(/-----[^-]+-----|\s/g,''),'base64');
const payload={bundleId:'mn.tureestei.app',environment:'Sandbox',productId:'mn.tureestei.app.credit1',transactionId:'123',signedDate:Date.now()};
async function token(chain=[leafPem,intermediatePem,rootPem], data=payload) {
  return new SignJWT(data).setProtectedHeader({alg:'ES256',x5c:chain.map(p=>der(p).toString('base64'))})
    .sign(await importPKCS8(KEYUTIL.getPEM(leaf.prvKeyObj,'PKCS8PRV'),'ES256'));
}
const verifier=(online=false)=>new AppleEdgeVerifier([der(rootPem)],online,Environment.SANDBOX,'mn.tureestei.app');
Deno.test('Edge certificate validates signatures, CA and strict dates without node X509',()=>{
  const r=new EdgeCertificate(rootPem), i=new EdgeCertificate(intermediatePem);
  assert(r.verify(r.publicKey)); assert(i.verify(r.publicKey)); assert(!r.verify(i.publicKey));
  assert(r.ca); assert(!new EdgeCertificate(leafPem).ca);
  assert(certificateDate('261104024800Z').toISOString()==='2026-11-04T02:48:00.000Z');
  assert(certificateDate('20261104024800').toISOString()==='2026-11-04T02:48:00.000Z');
});
Deno.test('Apple chain/OID and signed transaction validation succeeds with trusted synthetic chain',async()=>{
  assert((await verifier().verifyAndDecodeTransaction(await token())).transactionId==='123');
});
Deno.test('tampered JWS, untrusted root, missing Apple OID and wrong app/environment are rejected',async()=>{
  const signed=await token();
  const parts=signed.split('.'); parts[1]=Buffer.from(JSON.stringify({...payload,transactionId:'evil'})).toString('base64url');
  await rejects(()=>verifier().verifyAndDecodeTransaction(parts.join('.')));
  await rejects(()=>new AppleEdgeVerifier([der(intermediatePem)],false,Environment.SANDBOX,'mn.tureestei.app').verifyAndDecodeTransaction(signed));
  const noOid=certificate('leaf','intermediate',leaf,intermediate,false);
  await rejects(async()=>verifier().verifyAndDecodeTransaction(await token([noOid,intermediatePem,rootPem])));
  await rejects(async()=>verifier().verifyAndDecodeTransaction(await token(undefined,{...payload,bundleId:'foreign.app'})));
  await rejects(async()=>verifier().verifyAndDecodeTransaction(await token(undefined,{...payload,environment:'Production'})));
});
Deno.test('online mode still invokes revocation checks and fails closed',async()=>{
  let calls=0;
  class RejectRevoked extends AppleEdgeVerifier {
    protected override async checkOCSPStatus() {calls++; throw new Error('revocation check failed');}
  }
  await rejects(async()=>new RejectRevoked([der(rootPem)],true,Environment.SANDBOX,'mn.tureestei.app').verifyAndDecodeTransaction(await token()));
  assert(calls>0);
  // Missing OCSP responder is not accepted by the real implementation either.
  await rejects(async()=>verifier(true).verifyAndDecodeTransaction(await token()));
});

Deno.test('signed OCSP good response is accepted; revoked, stale and forged responses are rejected',async()=>{
  class Probe extends AppleEdgeVerifier { check(cert:EdgeCertificate,issuer:EdgeCertificate) {return this.checkOCSPStatus(cert,issuer);} }
  const probe=new Probe([der(rootPem)],true,Environment.SANDBOX,'mn.tureestei.app');
  const cert=new EdgeCertificate(leafPem), issuer=new EdgeCertificate(intermediatePem);
  const stamp=(ms:number)=>new Date(ms).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
  function response(status='good', next=Date.now()+3600000, signer=intermediate.prvKeyObj) {
    return Buffer.from(new (KJUR.asn1.ocsp as any).OCSPResponse({resstatus:'successful',restype:'ocspBasic',
      respid:{name:{str:'/CN=intermediate'}},prodat:{str:stamp(Date.now())},
      array:[{certid:{issuerCert:intermediatePem,subjectCert:leafPem,alg:'sha256'},
        status:status==='revoked'?{status,time:stamp(Date.now()-60000)}:{status},
        thisupdate:{str:stamp(Date.now()-600000)},nextupdate:{str:stamp(next)}}],
      sigalg:'SHA256withECDSA',reskey:signer,certs:[],
    } as any).getEncodedHex(),'hex');
  }
  const originalFetch=globalThis.fetch;
  try {
    let bytes=response();
    globalThis.fetch=(()=>Promise.resolve(new Response(bytes))) as typeof fetch;
    await probe.check(cert,issuer);
    bytes=response('revoked'); await rejects(()=>probe.check(cert,issuer));
    bytes=response('good',Date.now()-600000); await rejects(()=>probe.check(cert,issuer));
    bytes=response('good',Date.now()+3600000,leaf.prvKeyObj); await rejects(()=>probe.check(cert,issuer));
  } finally {globalThis.fetch=originalFetch;}
});
