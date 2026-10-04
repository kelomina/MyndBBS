// Retained cross-end hash/geometry regressions now target the signed plugin, not retired core modules.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import {createHash} from 'node:crypto'
const html=fs.readFileSync(new URL('../../backend/plugins/human-verification/ui/challenge.html',import.meta.url),'utf8')
const source=html.match(/<script>([\s\S]*?)<\/script>/)[1].split('(() => {')[0]
const context=vm.createContext({TextEncoder,Uint8Array});vm.runInContext(source,context)
test('plugin SHA256 and pipe-separated PoW match node crypto for fixed vectors',()=>{
 for(const [challenge,nonce]of [['abc','13'],['a'.repeat(32),'0'],['b'.repeat(32),'123456789']])assert.equal(context.powHash(challenge,nonce),createHash('sha256').update(challenge+'|'+nonce).digest('hex'))
 assert.equal(context.sha256Hex('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
 assert.equal(context.meetsLeadingZeroBits('00'+'f'.repeat(62),8),true)
 assert.equal(context.meetsLeadingZeroBits('00'+'f'.repeat(62),9),false)
})
test('plugin keeps geometry 0..11 permutation, micro-slots and real stroke samples',()=>{
 for(const token of ['1560','130','targetHour>=0','targetHour<12','point.s=stroke','new Set(c.puzzle.perm).size===12'])assert.ok(html.replace(/\s+/g,'').includes(token.replace(/\s+/g,'')),token)
 assert.doesNotMatch(html,/fallbackSlider|angleDeg|y: value % 7/)
})
