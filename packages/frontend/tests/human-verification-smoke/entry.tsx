import React, {useState} from 'react'
import {createRoot} from 'react-dom/client'
import {TranslationProvider} from '../../src/components/TranslationProvider'
import {HumanVerification} from '../../src/components/human-verification/HumanVerification'
import {HumanVerificationDialog} from '../../src/components/human-verification/HumanVerificationDialog'
import {RateLimitUnlockModal} from '../../src/components/RateLimitUnlockModal'
import en from '../../src/i18n/dictionaries/en.json'
import zh from '../../src/i18n/dictionaries/zh.json'
import type {VerificationPurpose} from '../../src/lib/human-verification/client'
function App(){
 const query=new URLSearchParams(location.search),purpose=(query.get('purpose')||'registration') as VerificationPurpose
 const [open,setOpen]=useState(false),[count,setCount]=useState(0)
 const dict=query.get('lang')==='zh'?zh:en
 const verified=async(token:string)=>{await fetch('/api/business',{method:'POST',body:JSON.stringify({captchaId:token})});setCount(v=>v+1);setOpen(false)}
 return <TranslationProvider dict={dict}><div className="min-h-screen bg-background p-4 text-foreground"><h1>Verification fixture</h1><button id="open" onClick={()=>setOpen(true)}>Open verification</button><output data-testid="completed">{count}</output>
 {purpose==='registration'?<div className="mx-auto mt-4 w-full max-w-[398px] rounded-xl border border-border p-4"><HumanVerification purpose={purpose} onVerified={verified}/></div>:purpose==='rateLimitUnlock'?<RateLimitUnlockModal isOpen={open} onClose={()=>setOpen(false)} retryAfterSec={30} onUnlocked={()=>{setCount(v=>v+1);setOpen(false)}}/>:<HumanVerificationDialog isOpen={open} onClose={()=>setOpen(false)} onVerified={verified} purpose={purpose}/>}
 </div></TranslationProvider>
}
document.documentElement.classList.toggle('dark',matchMedia('(prefers-color-scheme:dark)').matches)
createRoot(document.getElementById('root')!).render(<App/>);
