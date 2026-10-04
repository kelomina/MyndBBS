import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),ts=require('typescript'),root=path.resolve(import.meta.dirname,'..')
function load(file){const filename=path.join(root,file),loadedModule={exports:{}};const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('require','module','exports',code)((p)=>p.startsWith('.')?load(path.relative(root,path.resolve(path.dirname(filename),p+'.ts'))):require(p),loadedModule,loadedModule.exports);return loadedModule.exports}
const channel=load('src/lib/human-verification/channel.ts'),client=load('src/lib/human-verification/client.ts'),csp=load('src/lib/bff/isolated-ui.ts')
test('bridge accepts only bounded current nonce/challenge operation envelopes',()=>{
 const envelope={type:'answer',nonce:'n',challengeId:'c',solution:{nonce:'42'}}
 assert.deepEqual(channel.parseVerificationMessage(envelope,'n','c'),envelope)
 for(const data of [{...envelope,nonce:'old'},{...envelope,challengeId:'old'},{...envelope,type:'success'},{...envelope,url:'/api/admin'},{...envelope,solution:{huge:'x'.repeat(33000)}},{...envelope,solution:{n:NaN}},{...envelope,solution:[]}])assert.equal(channel.parseVerificationMessage(data,'n','c'),null)
 assert.equal(channel.isVerificationReady({type:'myndbbs:verification:ready',nonce:'n'},'n'),true)
 assert.equal(channel.isVerificationReady({type:'myndbbs:verification:ready',nonce:'n',success:true},'n'),false)
})
test('UI CSP recognizes BFF-normalized encoded paths without broadening other endpoints',()=>{
 for(const p of ['/api/human-verification/ui','/api/%68uman-verification/%75i','/api/human-verification%2fui','/api/unused%2f..%2fhuman-verification/ui','/api/unused%2f%252e%252e%2fhuman-verification/ui','/API/HUMAN-VERIFICATION/UI/'])assert.equal(csp.isHumanVerificationUiPath(p),true,p)
 for(const p of ['/','/api/human-verification/verify','/api/human-verification/ui-extra','/api/human-verification/ui/child','/api/%ZZ','/api/human-verification/%2575i'])assert.equal(csp.isHumanVerificationUiPath(p),false,p)
})
test('JSON rejects deep/unsafe values; HTTP helper rejects oversize before sending',async()=>{
 assert.equal(client.validJson(JSON.parse('{"__proto__":{}}')),false)
 let value={};for(let i=0;i<15;i++)value={value};assert.equal(client.validJson(value),false)
 await assert.rejects(client.verificationRequest('/verify',{solution:'x'.repeat(33000)}),e=>e.code==='ERR_HUMAN_VERIFICATION_INVALID')
})
test('signed UI is standalone, bounded and parses; core has no solver',()=>{
 const html=fs.readFileSync(path.join(root,'../backend/plugins/human-verification/ui/challenge.html'),'utf8')
 assert.ok(Buffer.byteLength(html)<256*1024)
 new vm.Script(html.match(/<script>([\s\S]*?)<\/script>/)[1])
 assert.doesNotMatch(html,/verificationToken|unlockToken|fetch\(|localStorage|document\.cookie/)
 for(const p of ['components/SliderCaptcha.tsx','components/federal/FederalCaptchaModal.tsx','components/federal/GeometryClock.tsx','components/federal/PowCollector.tsx','lib/federal/sha256.ts'])assert.equal(fs.existsSync(path.join(root,'src',p)),false,p)
})
