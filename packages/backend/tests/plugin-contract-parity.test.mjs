import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { generateKeyPairSync, sign } from 'node:crypto'
import { validateManifest, signingPayload, verifySignature } from '../../../scripts/plugin-v2.mjs'
const require = createRequire(import.meta.url)
const backend = require('../dist/infrastructure/plugins/PluginManifest.js')
const valid = {id:'demo',version:'1.2.3-beta+build',apiVersion:2,entry:'index.mjs',entrySha256:'a'.repeat(64),signatureKeyId:'test',capabilities:{routes:[{path:'/',methods:['GET']}],events:[],ui:[],config:{schema:{type:'object',properties:{token:{type:'string'}}},secretPaths:['/token']}}}
test('backend and isolated runtime share canonical signing and manifest rejection semantics',()=>{
 const cases=[valid,{...valid,apiVersion:1},{...valid,entry:'../x'}, {...valid,capabilities:{...valid.capabilities,config:{schema:{type:'object',$ref:'https://evil/schema'},secretPaths:[]}}}, {...valid,capabilities:{...valid.capabilities,routes:[{path:'/__events',methods:['POST']}]}}]
 const outcome=(fn,value)=>{try{fn(value);return 'ok'}catch(e){return e.message}}
 for(const input of cases) assert.equal(outcome(validateManifest,input),outcome(backend.validatePluginManifest,input))
 assert.equal(signingPayload('b'.repeat(64),valid).toString(),backend.signingPayload('b'.repeat(64),valid).toString())
 const {publicKey,privateKey}=generateKeyPairSync('ed25519'); const pem=publicKey.export({type:'spki',format:'pem'}); const signature=sign(null,signingPayload('b'.repeat(64),valid),privateKey)
 assert.ok(verifySignature(signature,pem,'b'.repeat(64),valid));assert.ok(backend.verifyDetachedSignature(signature,pem,'b'.repeat(64),valid))
 assert.equal(verifySignature(signature,pem,'c'.repeat(64),valid),false)
 assert.equal(backend.verifyDetachedSignature(signature,pem,'c'.repeat(64),valid),false)
})
