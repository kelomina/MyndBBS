/**
 * 纯 JS SHA-256（零外部依赖，file:// 可用，禁 crypto.subtle）。
 * 逐字移植自站外演示 captcha-federal-demo.html 内联实现（经用户批准的 ground truth），
 * 前后端前导零 bits 计数同一口径：hash hex 首 bits 全零即达标。
 * 进站拼装口径：`SHA256(challenge + '|' + nonce)`（challenge 为 hex32，nonce 为 hex 字符串）。
 */

/* eslint-disable no-var, @typescript-eslint/no-explicit-any */

// 演示原函数逐字移植（仅加 TS 类型标注，不改算术）
function sha256AsciiImpl(b: string): string {
  function c(a: number, bb: number): number {
    return (a >>> bb) | (a << (32 - bb));
  }
  for (
    var d: any, e: any, f = Math.pow, g = f(2, 32), h = 'length' as const, i = '', j: number[] = [], k = 8 * (b as any)[h], l: number[] = ((sha256AsciiImpl as any).h = (sha256AsciiImpl as any).h || []), m: number[] = ((sha256AsciiImpl as any).k = (sha256AsciiImpl as any).k || []), n: number = (m as any)[h], o: Record<number, number> = {}, p = 2;
    64 > n;
    p++
  )
    if (!o[p]) {
      for (d = 0; 313 > d; d += p) o[d] = p;
      l[n] = (f(p, 0.5) * g) | 0;
      m[n++] = (f(p, 1 / 3) * g) | 0;
    }
  b += '\x80';
  while ((b as any)[h] % 64 - 56) b += '\x00';
  for (d = 0; d < (b as any)[h]; d++) {
    e = b.charCodeAt(d);
    if (e >> 8) return '';
    j[d >> 2] |= e << (((3 - d) % 4) * 8);
  }
  j[(j as any)[h]] = (k / g) | 0;
  j[(j as any)[h]] = k;
  for (e = 0; e < (j as any)[h]; ) {
    var q: number[] = j.slice(e, (e += 16)),
      r: number[] = l;
    l = l.slice(0, 8);
    for (d = 0; 64 > d; d++) {
      var s: number = q[d - 15],
        t: number = q[d - 2],
        u: number = l[0]!,
        v: number = l[4]!,
        w: number =
          ((l[7]! + (c(v, 6) ^ c(v, 11) ^ c(v, 25)) + ((v & l[5]!) ^ (~v & l[6]!)) + m[d]! + (q[d] = 16 > d ? q[d]! : (q[d - 16]! + (c(s, 7) ^ c(s, 18) ^ (s >>> 3)) + q[d - 7]! + (c(t, 17) ^ c(t, 19) ^ (t >>> 10))) | 0)) | 0),
        x: number = (c(u, 2) ^ c(u, 13) ^ c(u, 22)) + ((u & l[1]!) ^ (u & l[2]!) ^ (l[1]! & l[2]!)) | 0;
      l = [(w + x) | 0].concat(l);
      l[4] = (l[4]! + w) | 0;
    }
    for (d = 0; 8 > d; d++) l[d] = (l[d]! + r[d]!) | 0;
  }
  for (d = 0; 8 > d; d++)
    for (e = 3; e + 1; e--) {
      var y: number = (l[d]! >> (8 * e)) & 255;
      i += (16 > y ? '0' : '') + y.toString(16);
    }
  return i;
}

function utf8EncodeImpl(s: string): string {
  return unescape(encodeURIComponent(s));
}

/** 对 UTF-8 字符串求 SHA-256 hex（与演示 sha256Hex 一致）。 */
export function sha256Hex(input: string): string {
  return sha256AsciiImpl(utf8EncodeImpl(input));
}

/** hash hex 是否满足前导零 bits（前后端同一口径）。 */
export function meetsLeadingZeroBits(hashHex: string, bits: number): boolean {
  let need = bits;
  for (let i = 0; i < hashHex.length && need > 0; i++) {
    const v = parseInt(hashHex.charAt(i), 16);
    for (let b = 3; b >= 0 && need > 0; b--, need--) {
      if ((v >> b) & 1) return false;
    }
  }
  return need <= 0;
}

/** 进站 PoW 拼装：SHA256(challenge + '|' + nonce)。 */
export function powHash(challenge: string, nonce: string): string {
  return sha256Hex(`${challenge}|${nonce}`);
}

/** 自检向量（演示 ground truth，单测用，不发生产）。 */
export function sha256SelfCheck(): boolean {
  // "abc" 标准向量
  return sha256Hex('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
}

/** Worker 源码（Blob URL 用，内联同一算法，零外部依赖）。 */
export const POW_WORKER_SOURCE = `
function sha256Ascii(b){function c(a,b){return(a>>>b)|(a<<(32-b))}for(var d,e,f=Math.pow,g=f(2,32),h="length",i="",j=[],k=8*b[h],l=sha256Ascii.h=sha256Ascii.h||[],m=sha256Ascii.k=sha256Ascii.k||[],n=m[h],o={},p=2;64>n;p++)if(!o[p]){for(d=0;313>d;d+=p)o[d]=p;l[n]=(f(p,.5)*g)|0;m[n++]=(f(p,1/3)*g)|0}b+="\\x80";while(b[h]%64-56)b+="\\x00";for(d=0;d<b[h];d++){e=b.charCodeAt(d);if(e>>8)return;j[d>>2]|=e<<(((3-d)%4)*8)}j[j[h]]=(k/g)|0;j[j[h]]=k;for(e=0;e<j[h];){var q=j.slice(e,e+=16),r=l;l=l.slice(0,8);for(d=0;64>d;d++){var s=q[d-15],t=q[d-2],u=l[0],v=l[4],w=(l[7]+(c(v,6)^c(v,11)^c(v,25))+((v&l[5])^((~v)&l[6]))+m[d]+(q[d]=(16>d)?q[d]:(q[d-16]+(c(s,7)^c(s,18)^(s>>>3))+q[d-7]+(c(t,17)^c(t,19)^(t>>>10)))|0))|0,x=((c(u,2)^c(u,13)^c(u,22))+((u&l[1])^(u&l[2])^(l[1]&l[2])))|0;l=[(w+x)|0].concat(l);l[4]=(l[4]+w)|0}for(d=0;8>d;d++)l[d]=(l[d]+r[d])|0}for(d=0;8>d;d++)for(e=3;e+1;e--){var y=(l[d]>>(8*e))&255;i+=((16>y)?"0":"")+y.toString(16)}return i}
function sha256Hex(s){s=unescape(encodeURIComponent(s));return sha256Ascii(s)}
function meetsBits(hashHex,bits){var need=bits;for(var i=0;i<hashHex.length&&need>0;i++){var v=parseInt(hashHex.charAt(i),16);for(var b=3;b>=0&&need>0;b--,need--){if((v>>b)&1)return false}}return need<=0}
onmessage = function(e){
  var d = e.data || {};
  var challenge = d.challenge, bits = d.bits, startNonce = d.startNonce || 0, chunk = d.chunk || 1200;
  var nonce = startNonce, tried = 0;
  var useHex = !!d.hexNonce;
  function fmt(n){ return useHex ? n.toString(16) : String(n); }
  while (true){
    for (var i = 0; i < chunk; i++){
      var ns = fmt(nonce);
      var h = sha256Hex(challenge + '|' + ns);
      tried++;
      if (meetsBits(h, bits)){ postMessage({ type: 'found', nonce: ns, hash: h, tried: tried }); return; }
      nonce++;
      if (nonce % 5000 === 0){ postMessage({ type: 'progress', nonce: ns, tried: tried }); }
    }
    postMessage({ type: 'progress', nonce: fmt(nonce), tried: tried });
  }
};
`;
