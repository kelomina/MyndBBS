// Real shipped React + signed-provider HTML; HTTP API is an isolated fixture, NOT core/runtime integration.
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import {createRequire} from 'node:module'
import {createServer} from 'node:http'
import {createHash,randomBytes} from 'node:crypto'
import {chromium,expect} from '@playwright/test'
import {SvgCaptchaGenerator} from '../../backend/plugins/human-verification/algorithms/image.mjs'
import {CaptchaChallenge} from '../../backend/plugins/human-verification/algorithms/slider.mjs'
import {verifyGeometryReading,verifyGeometryBehavior} from '../../backend/plugins/human-verification/algorithms/geometry.mjs'
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'tests/human-verification-smoke/artifacts')
await fs.mkdir(out,{recursive:true})
const {webpack}=require('next/dist/compiled/webpack/webpack.js')
await new Promise((resolve,reject)=>{const compiler=webpack({mode:'development',devtool:false,entry:path.join(root,'tests/human-verification-smoke/entry.tsx'),output:{path:out,filename:'bundle.js'},resolve:{extensions:['.tsx','.ts','.js']},module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:path.join(root,'tests/plugin-ui-smoke/loader.cjs')}]},plugins:[new webpack.DefinePlugin({'process.env.NODE_ENV':JSON.stringify('development')})]});compiler.run((error,stats)=>compiler.close(()=>error||stats?.hasErrors()?reject(error??new Error(stats.toString({all:false,errors:true}))):resolve()))})
const postcss=createRequire(require.resolve('next/package.json'))('postcss'),tailwind=require('@tailwindcss/postcss')
const css=await postcss([tailwind({base:root})]).process(await fs.readFile(path.join(root,'src/app/globals.css'),'utf8'),{from:path.join(root,'src/app/globals.css')})
await fs.writeFile(path.join(out,'style.css'),css.css)
const providerHtml=await fs.readFile(path.join(root,'../backend/plugins/human-verification/ui/challenge.html'),'utf8')
const policy=(await fs.readFile(path.join(root,'src/middleware/csp.ts'),'utf8')).match(/const PLUGIN_UI_RESPONSE_CSP = "([^"]+)"/)[1]
let kind='slider',powBits=8,strength='low',unavailable=false,hold=false,verifyCount=0,completed=0,unlockCount=0,lastSolution=null,requests=[],currentId=''
const failures=[],checks=[],pageErrors=[],screenshots=[]
function check(name){checks.push(name)}
const server=createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://fixture.invalid');requests.push(url.pathname)
  const json=(data,status=200)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data))}
  if(url.pathname==='/api/human-verification/ui'){res.writeHead(200,{'content-type':'text/html','content-security-policy':policy,'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(providerHtml);return}
  if(url.pathname==='/api/human-verification/requirements'){json({enabled:true,surfaces:{registration:true,post:true,comment:true,friendRequest:true},available:!unavailable,providerId:'human-verification'});return}
  if(url.pathname==='/api/human-verification/challenge'){
   currentId=randomBytes(32).toString('base64url')
   const challenge=kind==='slider'?{kind,image:SvgCaptchaGenerator.generateImage(120),strength}:kind==='geometry'?{kind,puzzleType:'rotation',puzzle:{perm:[0,1,2,3,4,5,6,7,8,9,10,11],targetHour:3},geometryLevel:1,strength,timeoutSec:60,strictTimeoutSec:60}:{kind,challengeHex:'a'.repeat(32),bits:powBits}
   json({challengeId:currentId,challenge,expiresInSec:300});return
  }
  if(url.pathname==='/api/human-verification/verify'){
   const chunks=[];for await(const c of req)chunks.push(c)
   const data=JSON.parse(Buffer.concat(chunks).toString());lastSolution=data.solution;verifyCount++
   assert.equal(data.challengeId,currentId);assert.equal(data.solution.kind,undefined)
   if(kind==='slider')CaptchaChallenge.create({id:'fixture',targetPosition:120,strength,expiresAt:new Date(Date.now()+300000),verified:false}).verifyTrajectory(data.solution.dragPath,data.solution.totalDragTime,data.solution.finalPosition)
   else if(kind==='geometry'){verifyGeometryReading([0,1,2,3,4,5,6,7,8,9,10,11],3,data.solution.microSlot,strength);verifyGeometryBehavior(data.solution.behaviorSamples,strength,60,60)}
   else assert.equal(createHash('sha256').update('a'.repeat(32)+'|'+data.solution.nonce).digest()[0],0)
   if(hold)await new Promise(resolve=>setTimeout(resolve,600))
   json({verificationToken:'P'.repeat(43),expiresInSec:300});return
  }
  if(url.pathname==='/api/human-verification/unlock'){unlockCount++;json({unlockToken:'fixture-unlock',exemptMinutes:15,expiresAt:new Date(Date.now()+900000).toISOString()});return}
  if(url.pathname==='/api/business'){const chunks=[];for await(const c of req)chunks.push(c);assert.equal(JSON.parse(Buffer.concat(chunks).toString()).captchaId,'P'.repeat(43));completed++;json({ok:true});return}
  if(url.pathname==='/bundle.js'||url.pathname==='/style.css'){res.setHeader('content-type',url.pathname.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8');res.end(await fs.readFile(path.join(out,url.pathname.slice(1))));return}
  res.setHeader('content-security-policy',"default-src 'self'; script-src 'self' 'nonce-fixture'; style-src 'self' 'nonce-fixture'; style-src-attr 'none'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'")
  res.setHeader('content-type','text/html');res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script nonce="fixture" src="/bundle.js"></script></body></html>')
 }catch(e){failures.push(String(e));console.error('fixture failure:',e);res.writeHead(400,{'content-type':'application/json'});res.end(JSON.stringify({error:'ERR_HUMAN_VERIFICATION_INVALID'}))}
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const browser=await chromium.launch({headless:true}),context=await browser.newContext({viewport:{width:320,height:720}}),page=await context.newPage(),base='http://127.0.0.1:'+server.address().port
page.on('pageerror',e=>pageErrors.push(String(e)))
const timeout=setTimeout(()=>{console.error('browser smoke timeout');process.exit(1)},90000);timeout.unref()
const frame=()=>page.frameLocator('iframe')
async function open(purpose='registration',lang='en'){await page.goto(base+'/?purpose='+purpose+'&lang='+lang);if(purpose!=='registration')await page.locator('#open').click();if(kind!=='pow')await frame().getByRole('heading').waitFor()}
async function shot(name){const file=path.join(out,name+'.png');await page.screenshot({path:file,fullPage:true});screenshots.push(file);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,name);if(await page.locator('iframe').count())assert.equal(await frame().locator('body').evaluate(el=>el.scrollWidth<=innerWidth),true,name+' frame')}
async function slider(){const box=await frame().locator('canvas').boundingBox();const scale=box.width/318;await page.mouse.move(box.x+24*scale,box.y+64*scale);await page.mouse.down();const positions=[0,4,8,180,184,188,20,24,28,230,232,234,100,104,108,112,116,120];for(let i=0;i<positions.length;i++){await page.mouse.move(box.x+(positions[i]+24)*scale,box.y+(64+Math.sin(i)*14)*scale);await new Promise(r=>setTimeout(r,i%3===0?70:18))}await page.mouse.up();await frame().getByRole('button',{name:/^(Verify|验证)$/}).click()}
try{
 await open();await shot('registration-320-en');check('real plugin script executes beneath a nonce-protected parent')
 assert.equal(await frame().locator('body').evaluate(()=>{try{void document.cookie;return false}catch{return true}}),true);check('opaque frame cannot read cookies')
 const count=verifyCount;await page.evaluate(()=>{const f=document.querySelector('iframe'),nonce=new URL(f.src).hash.slice(7);window.postMessage({type:'myndbbs:verification:ready',nonce},'*');window.postMessage({type:'answer',nonce,challengeId:'forged',solution:{}},'*')});await new Promise(r=>setTimeout(r,100));assert.equal(verifyCount,count);check('window forgeries cannot submit an answer')
 await slider();await page.getByTestId('completed').filter({hasText:'1'}).waitFor();assert.equal(completed,1);check('real slider samples pass migrated low algorithm; business receives proof alias')
 await open();await frame().locator('canvas').focus();for(let i=0;i<60;i++){await page.keyboard.press('ArrowRight');if(i%10===0){await page.keyboard.press('ArrowDown');await new Promise(r=>setTimeout(r,40))}}await frame().getByRole('button',{name:'Verify',exact:true}).click();await page.getByTestId('completed').filter({hasText:'1'}).waitFor();check('real keyboard movement produces accepted slider samples without synthetic pointer events')
 strength='strict';await open('post','zh');await shot('post-320-zh');await slider();await page.getByTestId('completed').filter({hasText:'1'}).waitFor();check('post dialog slider passes migrated strict thresholds')
 kind='geometry';await page.emulateMedia({colorScheme:'dark'});await page.setViewportSize({width:390,height:844});await open('rateLimitUnlock','zh');await shot('geometry-390-dark-zh');
 const box=await frame().locator('canvas').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height*.2);await page.mouse.down();for(let i=0;i<=20;i++){const a=(i/20)**1.3*Math.PI/2;await page.mouse.move(box.x+(100+Math.sin(a)*60)/200*box.width,box.y+(100-Math.cos(a)*60)/200*box.height);await new Promise(r=>setTimeout(r,30+i%3*10))}await page.mouse.up();await frame().getByRole('button',{name:'验证',exact:true}).click();await page.getByTestId('completed').filter({hasText:'1'}).waitFor();assert.equal(unlockCount,1);check('geometry strict samples verify and core wrapper exchanges unlock once')
 kind='pow';strength='low';await page.emulateMedia({colorScheme:'light'});await page.setViewportSize({width:1200,height:800});powBits=24;await open('rateLimitUnlock');await frame().getByRole('heading').waitFor();await shot('pow-desktop-en');await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).first().click();powBits=8;await open('rateLimitUnlock');await page.getByTestId('completed').filter({hasText:'1'}).waitFor();assert.ok(typeof lastSolution.nonce==='string');assert.equal(unlockCount,2);check('plugin PoW answer verified against node SHA256 then unlock')
 kind='slider';await page.setViewportSize({width:568,height:320});await open('comment');await shot('comment-landscape-320h');
 const dialog = page.getByRole('dialog')
 await frame().getByRole('button',{name:'Verify',exact:true}).waitFor()
 // Wait for the asynchronous resize port message before measuring/scrolling.
 await expect.poll(async () => {
  const contentHeight = await frame().locator('main').evaluate(el => Math.max(240,Math.min(640,Math.ceil(el.getBoundingClientRect().height+24))))
  return Math.abs(Number(await page.locator('iframe').getAttribute('height'))-contentHeight)
 }).toBeLessThanOrEqual(1)
 // The 60dvh iframe cap provides its own scroll surface on short viewports.
 const landscapeFrameScroll = await frame().locator('body').evaluate(() => {
  const el = document.scrollingElement
  el.scrollTop = el.scrollHeight
  return {scrollTop:el.scrollTop,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}
 })
 assert.ok(landscapeFrameScroll.scrollWidth<=landscapeFrameScroll.clientWidth, 'frame has no horizontal overflow')
 await dialog.evaluate(el => { el.scrollTop = el.scrollHeight })
 const landscapeScroll = await dialog.evaluate(el => ({scrollTop:el.scrollTop,scrollHeight:el.scrollHeight,clientHeight:el.clientHeight,scrollWidth:el.scrollWidth,clientWidth:el.clientWidth}))
 assert.ok(landscapeScroll.scrollTop > 0, 'short dialog scrolls internally')
 assert.ok(Math.abs(landscapeScroll.scrollHeight-landscapeScroll.clientHeight-landscapeScroll.scrollTop)<=1, 'dialog reaches bottom')
 assert.ok(landscapeScroll.scrollWidth<=landscapeScroll.clientWidth, 'dialog has no horizontal overflow')
 const cancel = dialog.getByRole('button',{name:'Cancel',exact:true}).last()
 const verify = frame().getByRole('button',{name:'Verify',exact:true})
 const panelBox = await dialog.boundingBox()
 for (const control of [verify,cancel]) {
  const box = await control.boundingBox()
  assert.ok(box && box.y>=panelBox.y && box.y+box.height<=panelBox.y+panelBox.height && box.y>=0 && box.y+box.height<=320, 'bottom controls are fully inside visible dialog')
 }
 await shot('comment-landscape-320h-scrolled-bottom')
 const beforeCancelVerify = verifyCount
 const cancelBox = await cancel.boundingBox()
 // Raw pointer click: no locator auto-scroll can conceal an unreachable button.
 await page.mouse.click(cancelBox.x+cancelBox.width/2,cancelBox.y+cancelBox.height/2)
 await dialog.waitFor({state:'detached'})
 assert.equal(verifyCount,beforeCancelVerify)
 await expect(page.locator('#open')).toBeFocused()
 check('568x320 dialog scrolls to visible Verify/Cancel without horizontal overflow; pointer Cancel closes and restores focus')
 await open('comment');await frame().locator('canvas').focus();await page.keyboard.press('Escape');await page.getByRole('dialog').waitFor({state:'detached'});assert.equal(await page.locator('#open').evaluate(e=>e===document.activeElement),true);check('iframe Escape cancels and returns focus')
 await page.setViewportSize({width:390,height:844});await open('friendRequest');await frame().getByRole('button',{name:'Verify',exact:true}).focus();await page.keyboard.press('Tab');await expect(page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).last()).toBeFocused();await page.keyboard.press('Tab');await expect(page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).first()).toBeFocused();check('frame Tab boundary and outer dialog focus wrap')
 await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).first().click();hold=true;await open('comment');const before=completed;await slider();await page.getByRole('dialog').getByRole('button',{name:'Cancel',exact:true}).first().click();await new Promise(r=>setTimeout(r,800));assert.equal(completed,before);hold=false;check('closing during verification discards late proof and never posts business')
 unavailable=true;await page.goto(base+'/?purpose=registration&lang=zh');await page.getByRole('alert').waitFor();await shot('unavailable-390-zh');assert.equal(await page.locator('iframe').count(),0);check('provider outage fail-closed with no solver fallback');unavailable=false
 assert.deepEqual(failures,[]);assert.deepEqual(pageErrors,[])
 const result={ok:true,checks,pageErrors,landscapeScroll,landscapeFrameScroll,verifyRequests:verifyCount,unlockRequests:unlockCount,screenshots,scope:'real Chromium + shipped React and HTML + migrated algorithms; fixture API, not Redis/control/runtime/production'};await fs.writeFile(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result))
}finally{clearTimeout(timeout);await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
