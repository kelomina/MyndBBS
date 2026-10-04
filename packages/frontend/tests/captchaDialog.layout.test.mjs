import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8')
for(const[file,handler]of [['src/app/compose/ComposeForm.tsx','handlePublish'],['src/app/p/[id]/CommentsSection.tsx','handleSubmit']])test(file+' retains responsive verification dialog and submission callback',()=>{
 const source=read(file),dialog=read('src/components/human-verification/HumanVerificationDialog.tsx')
 for(const token of ['p-4','w-full','max-w-[398px]','min-w-0','max-h-[90dvh]','overflow-y-auto'])assert.ok(dialog.includes(token))
 assert.ok(source.includes('onVerified={'+handler+'}'))
 assert.doesNotMatch(source,/SliderCaptcha/)
})
