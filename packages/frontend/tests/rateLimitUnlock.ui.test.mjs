import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8')
test('unlock consumes a neutral proof and retains header token plus one-read-retry integration',()=>{
 const modal=read('src/components/RateLimitUnlockModal.tsx'),api=read('src/lib/rate-limit/unlock.ts')
 assert.match(modal,/purpose="rateLimitUnlock"/)
 assert.match(modal,/postUnlock\(\{\s*verificationToken\s*\}/)
 assert.match(modal,/saveUnlockToken\(result\)/)
 assert.match(modal,/generation\.current/)
 assert.doesNotMatch(api,/redeemToken|dragPath|kind:/)
 assert.match(read('src/lib/rate-limit/errors.ts'),/\/api\/human-verification\/unlock/)
 assert.match(read('src/lib/rate-limit/unlock-token.ts'),/X-RateLimit-Unlock/)
})
test('neutral host owns loading, cooldown, cancellation, errors, expiration and a bounded sandbox',()=>{
 const source=read('src/components/human-verification/HumanVerification.tsx')
 for(const key of ['loading','verifying','success','error','cooldown','onCancel','role="alert"','role="status"','expiresInSec','sandbox="allow-scripts"','referrerPolicy="no-referrer"','controller.abort()'])assert.ok(source.includes(key),key)
 assert.doesNotMatch(source,/srcDoc|allow-same-origin|SliderCaptcha|FederalCaptcha/)
})
test('human verification translations are bilingual and have equal neutral keys',()=>{
 const en=JSON.parse(read('src/i18n/dictionaries/en.json')),zh=JSON.parse(read('src/i18n/dictionaries/zh.json'))
 assert.deepEqual(Object.keys(en.humanVerification).sort(),Object.keys(zh.humanVerification).sort())
 for(const code of ['ERR_HUMAN_VERIFICATION_INVALID','ERR_HUMAN_VERIFICATION_UNAVAILABLE']){assert.ok(en.apiErrors[code]);assert.ok(zh.apiErrors[code])}
 assert.equal(en.captcha,undefined)
})
