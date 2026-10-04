// Solver expectations move with the retired core components into the signed provider UI.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const html=fs.readFileSync(new URL('../../backend/plugins/human-verification/ui/challenge.html',import.meta.url),'utf8')
test('all three solver branches and cancellation live only in the provider HTML',()=>{
 for(const word of ['slider','geometry','pow','dragPath','totalDragTime','finalPosition','microSlot','behaviorSamples','challengeHex','meetsLeadingZeroBits','pointercancel','ArrowUp','ArrowDown','focus-boundary'])assert.ok(html.includes(word),word)
 assert.doesNotMatch(html,/federal\/issue|federal\/verify|fallbackSlider|import .*frontend/)
 assert.ok(html.replace(/\s+/g,'').includes("post('answer',{solution})"))
})
