import { SignedDataVerifier, VerificationException, VerificationStatus, Environment } from 'npm:@apple/app-store-server-library@2.0.0';
import { Buffer } from 'node:buffer';
import { createHash, createPublicKey } from 'node:crypto';
import { KEYUTIL, KJUR, X509, ASN1HEX } from 'npm:jsrsasign@11.1.5';
import { compactVerify, importSPKI } from 'npm:jose@5.9.6';

const fail = () => new VerificationException(VerificationStatus.VERIFICATION_FAILURE);
const skew = 60_000;
export function certificateDate(value: string): Date {
  if (/^\d{8}T\d{6}Z$/.test(value)) value = value.replace('T', '');
  if (/^\d{14}$/.test(value)) value += 'Z';
  const full = /^\d{12}Z$/.test(value) ? (Number(value.slice(0, 2)) >= 50 ? '19' : '20') + value : value;
  if (!/^\d{14}Z$/.test(full)) throw fail();
  return new Date(`${full.slice(0,4)}-${full.slice(4,6)}-${full.slice(6,8)}T${full.slice(8,10)}:${full.slice(10,12)}:${full.slice(12,14)}Z`);
}

// Structural adapter for Apple's chain validator; no unsupported node X509 operations.
export class EdgeCertificate {
  readonly parsed = new X509();
  readonly raw: Buffer;
  constructor(encoded: Buffer | string) {
    if (typeof encoded === 'string' && encoded.includes('-----BEGIN CERTIFICATE-----')) {
      this.parsed.readCertPEM(encoded);
      this.raw = Buffer.from(this.parsed.hex!, 'hex');
    } else {
      this.raw = Buffer.isBuffer(encoded) ? encoded : Buffer.from(encoded, 'base64');
      this.parsed.readCertHex(this.raw.toString('hex'));
    }
  }
  toString() { return `-----BEGIN CERTIFICATE-----\n${this.raw.toString('base64').match(/.{1,64}/g)!.join('\n')}\n-----END CERTIFICATE-----\n`; }
  get publicKey() { return createPublicKey(KEYUTIL.getPEM(this.parsed.getPublicKey())); }
  get subject() { return this.parsed.getSubjectHex(); }
  get issuer() { return this.parsed.getIssuerHex(); }
  get ca() { return this.parsed.getExtBasicConstraints()?.cA === true; }
  get validFrom() { return certificateDate(this.parsed.getNotBefore()).toISOString(); }
  get validTo() { return certificateDate(this.parsed.getNotAfter()).toISOString(); }
  verify(key: ReturnType<typeof createPublicKey>) {
    try { return this.parsed.verifySignature(KEYUTIL.getKey(String(key.export({type:'spki',format:'pem'})))) === true; }
    catch { return false; }
  }
}

// Retains Apple's certificate-chain/OID/date/cache and app/environment validators.
// Replaces only Node X509 parsing, node-fetch transport and JWT signature primitives
// with Edge-compatible implementations. Online revocation checks remain mandatory.
export class AppleEdgeVerifier extends SignedDataVerifier {
  constructor(roots: Buffer[], online: boolean, environment: Environment, bundle: string, appId?: number) {
    super(roots, online, environment, bundle, appId);
    this.rootCertificates = roots.map(root => new EdgeCertificate(root)) as any;
  }
  protected override async verifyJWT<T>(jwt: string, validator: {validate(data: unknown): boolean}, signedDateExtractor: (data:T)=>Date): Promise<T> {
    try {
      const parts = jwt.split('.');
      if (parts.length !== 3) throw fail();
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      const data = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      if (header.alg !== 'ES256' || !validator.validate(data) || !Array.isArray(header.x5c) || header.x5c.length !== 3) throw fail();
      if (this.environment !== Environment.SANDBOX && this.environment !== Environment.PRODUCTION) throw fail();
      const leaf = new EdgeCertificate(Buffer.from(header.x5c[0], 'base64'));
      const intermediate = new EdgeCertificate(Buffer.from(header.x5c[1], 'base64'));
      const key = await this.verifyCertificateChain(this.rootCertificates, leaf as any, intermediate as any,
        this.enableOnlineChecks ? new Date() : signedDateExtractor(data));
      const publicKey = await importSPKI(String(key.export({type:'spki',format:'pem'})), 'ES256');
      await compactVerify(jwt, publicKey, {algorithms:['ES256']});
      return data as T;
    } catch (error) {
      if (error instanceof VerificationException) throw error;
      throw new VerificationException(VerificationStatus.VERIFICATION_FAILURE, error instanceof Error ? error : undefined);
    }
  }

  // Adapted from Apple's MIT-licensed checkOCSPStatus (library v2.0.0).
  // Authenticates the responder, response signature, exact CertID and freshness.
  protected override async checkOCSPStatus(cert: any, issuer: any): Promise<void> {
    const urls = cert.parsed.getExtAIAInfo()?.ocsp;
    if (!Array.isArray(urls) || !urls.length) throw fail();
    const url = new URL(urls[0]);
    if (!['http:','https:'].includes(url.protocol) || !/(^|\.)apple\.com$/.test(url.hostname) || url.username || url.password) throw fail();
    const request = new KJUR.asn1.ocsp.OCSPRequest({reqList:[{issuerCert:issuer.toString(),subjectCert:cert.toString(),alg:'sha256'}]});
    const response = await fetch(url, {method:'POST', headers:{'Content-Type':'application/ocsp-request'},
      body:Buffer.from(request.getEncodedHex(),'hex'), signal:AbortSignal.timeout(15000), redirect:'error'});
    if (!response.ok) throw fail();
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 100000) throw fail();
    const parsed = new (KJUR.asn1.ocsp as any).OCSPParser().getOCSPResponse(bytes.toString('hex'));
    const candidates = [issuer, ...(parsed.certs ?? []).map((hex:string)=>new EdgeCertificate(Buffer.from(hex,'hex')))];
    const signer = candidates.find(candidate => {
      if (parsed.respid?.key) return createHash('sha1').update(Buffer.from(candidate.parsed.getSPKIValue(),'hex')).digest('hex') === parsed.respid.key;
      return parsed.respid?.name && candidate.parsed.getSubject().str === parsed.respid.name.str;
    });
    if (!signer) throw fail();
    const sameIssuer = signer.raw.equals(issuer.raw);
    if (!sameIssuer) {
      if (!signer.verify(issuer.publicKey) || signer.issuer !== issuer.subject
        || !signer.parsed.getExtExtKeyUsage()?.array?.includes('ocspSigning')) throw fail();
      const now = Date.now();
      if (Date.parse(signer.validFrom) > now + skew || Date.parse(signer.validTo) < now - skew) throw fail();
    }
    if (!/^(SHA256|SHA384|SHA512)with/.test(parsed.alg ?? '')) throw fail();
    const signedData = ASN1HEX.getTLVbyList(bytes.toString('hex'),0,[1,0,1,0,0]);
    const signature = new KJUR.crypto.Signature({alg:parsed.alg});
    signature.init(signer.parsed.getPublicKey()); signature.updateHex(signedData!);
    if (!signature.verify(parsed.sighex)) throw fail();
    const certId = new (KJUR.asn1.ocsp.CertID as any)().getParamByCerts(issuer.toString(),cert.toString(),'sha256');
    for (const entry of parsed.array ?? []) {
      if (!['alg','issname','isskey','sbjsn'].every(key=>certId[key] === entry.certid?.[key])) continue;
      const now = Date.now();
      const issued = certificateDate(entry.thisupdate).getTime(), next = certificateDate(entry.nextupdate).getTime();
      if (entry.status?.status !== 'good' || !Number.isFinite(issued) || !Number.isFinite(next)
        || issued > now + skew || next < now - skew || next <= issued) throw fail();
      return;
    }
    throw fail();
  }
}
