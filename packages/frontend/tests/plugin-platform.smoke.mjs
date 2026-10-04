// Run from packages/frontend: node tests/plugin-platform.smoke.mjs
// Actual shipped React components + Tailwind, isolated API fixtures (not a backend integration test).
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { createServer } from 'node:http'
import { chromium } from '@playwright/test'
const require = createRequire(import.meta.url)
const preview = process.argv.includes('--preview')
const root = path.resolve(import.meta.dirname, '..')
const output = path.join(root, 'tests/plugin-ui-smoke/artifacts')
await fs.mkdir(output, { recursive: true })
const { webpack } = require('next/dist/compiled/webpack/webpack.js')
await new Promise((resolve,reject) => {
 const compiler = webpack({ mode:'development', devtool: false, entry:path.join(root,'tests/plugin-ui-smoke/entry.tsx'), output:{path:output,filename:'bundle.js'}, resolve:{extensions:['.tsx','.ts','.js'],alias:{'@myndbbs/shared':path.join(root,'../shared/src/index.ts')}}, module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:path.join(root,'tests/plugin-ui-smoke/loader.cjs')}]}, plugins:[new webpack.DefinePlugin({'process.env.API_URL':JSON.stringify(''),'process.env.NODE_ENV':JSON.stringify('development')})] })
 compiler.run((error,stats) => compiler.close(() => error || stats?.hasErrors() ? reject(error ?? new Error(stats.toString({all:false,errors:true}))) : resolve()))
})
const postcss = createRequire(require.resolve('next/package.json'))('postcss')
const tailwind = require('@tailwindcss/postcss')
const css = await postcss([tailwind({base:root})]).process(await fs.readFile(path.join(root,'src/app/globals.css'),'utf8'),{from:path.join(root,'src/app/globals.css')})
await fs.writeFile(path.join(output,'style.css'),css.css)
const server = createServer(async(req,res) => {
 try {
  if(req.url.startsWith('/api/')){const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks).toString('utf8');await handleApiRoute({request:()=>({url:()=>`http://127.0.0.1${req.url}`,method:()=>req.method,headers:()=>req.headers,postDataJSON:()=>JSON.parse(body||'{}')}),fulfill:({status=200,contentType,body})=>{res.statusCode=status;res.setHeader('Content-Type',`${contentType}; charset=utf-8`);res.end(body)}});return}
  if (req.url === '/bundle.js' || req.url === '/style.css') { res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8'); res.end(await fs.readFile(path.join(output,req.url.slice(1)))); return }
  // Match production nonce inheritance, while permitting the compiled stylesheet with a nonce.
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'nonce-smoke-nonce'; style-src 'self' 'nonce-smoke-nonce'; style-src-attr 'none'; connect-src 'self'; img-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'self'")
  res.setHeader('Content-Type','text/html; charset=utf-8')
  res.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script nonce="smoke-nonce" src="/bundle.js"></script></body></html>')
 } catch(error) {res.statusCode=500;res.end(String(error))}
})
await new Promise(resolve=>server.listen(preview?3197:0,'127.0.0.1',resolve))
const base=`http://127.0.0.1:${server.address().port}`
const browser=preview?null:await chromium.launch({headless:true})
const checks=[]
// Execute the real server route guard with only its profile transport/cookie boundary replaced.
const ts=require('typescript'), vm=await import('node:vm')
const pageSource=await fs.readFile(path.join(root,'src/app/admin/plugins/page.tsx'),'utf8')
const guardModule={exports:{}}
let serverRole='MODERATOR'
vm.runInNewContext(ts.transpileModule(pageSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{exports:guardModule.exports,module:guardModule,require:(name)=>name==='next/headers'?{cookies:async()=>({getAll:()=>[]})}:name.includes('serverApi')?{serverFetch:async()=>({ok:true,json:async()=>({user:{role:serverRole}})})}:name.includes('PluginAdminClient')?{default:()=>null}:require(name)})
await assert.rejects(()=>guardModule.exports.default(),/NEXT_HTTP_ERROR_FALLBACK;404/)
serverRole='ADMIN';assert.ok(await guardModule.exports.default());checks.push('real server page guard throws Next 404 for MODERATOR; ADMIN allowed')
let role='SUPER_ADMIN', sudo=false, saved, mutations=0, htmlFetches=0, bridgeReads=0
let runtime='ACTIVE', desiredOverride=null
const schema={type:'object',required:['options','enabled','mode','ports'],additionalProperties:false,properties:{options:{type:'object',required:['label','limit'],properties:{label:{type:'string',minLength:1,maxLength:100},limit:{type:'number',minimum:1,maximum:10},token:{type:'string',minLength:1}}},enabled:{type:'boolean'},mode:{type:'string',enum:['safe','audit']},ports:{type:'array',minItems:1,maxItems:3,items:{type:'integer',minimum:1,maximum:65535}}}}
const config={options:{label:'Sample plugin',limit:3,token:'********'},enabled:true,mode:'safe',ports:[8080]}
const plugin=()=>({id:'db-sample',pluginId:'sample',displayName:'Signed sample plugin',description:null,desiredState:desiredOverride??(['ACTIVE','ROLLED_BACK','UNHEALTHY'].includes(runtime)?'ACTIVE':'DISABLED'),runtimeState:runtime,currentVersion:'2.0.0',lastError:null,healthy:runtime==='ACTIVE'?true:null,lastHealthAt:'2026-10-02T01:00:00.000Z',releases:[{id:'release1',version:'2.0.0',apiVersion:2,artifactSha256:'a'.repeat(64),signatureKeyId:'dev',state:'APPROVED',uploadedAt:'2026-10-02T00:00:00Z',approvedAt:'2026-10-02T00:01:00Z',activatedAt:null}],config,configSchema:schema,secretPaths:['/options/token'],routeCapabilities:[{path:'/status',methods:['GET'],auth:'admin'},{path:'/write-only',methods:['POST'],auth:'admin'}],uiMounts:[{slot:'admin.sidebar',path:'sidebar.html'},{slot:'admin.dashboard',path:'dashboard.html'},{slot:'admin.detail',path:'panel.html'}]})
const html=`<!doctype html><html><head><style>body{font:14px Arial;padding:12px;color:#334155;background:#f8fafc}p{overflow-wrap:anywhere}</style></head><body><p id="ready">Waiting</p><script>
window.addEventListener('message',e=>{if(e.data.type!=='myndbbs:plugin:init')return;window.initCount=(window.initCount||0)+1;window.bridge=e.ports[0];window.nonce=e.data.nonce;document.getElementById('ready').textContent='Sandbox ready: '+e.data.slot;window.bridge.onmessage=e=>{window.lastReply=e.data};window.bridge.start();});
window.storageBlocked=false;try{localStorage.getItem('anything')}catch{window.storageBlocked=true}
</script></body></html>`
const context=await browser?.newContext()
await context?.addInitScript(()=>{window.closedPorts=0;const original=MessagePort.prototype.close;MessagePort.prototype.close=function(){window.closedPorts++;return original.call(this)}})
const requests=[]
const handleApiRoute=async route=>{
 const req=route.request(), url=new URL(req.url()), p=url.pathname; requests.push({path:p,method:req.method()})
 const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)})
 if(p==='/api/v1/user/profile')return json({user:{id:'u',role,hasPassword:true}})
 if(p==='/api/v1/user/sudo/check')return json({isSudo:sudo})
 if(p==='/api/v1/user/sudo/verify'){sudo=true;return json({success:true})}
 if(p==='/api/admin/plugins')return json([plugin()])
 if(p.endsWith('/health'))return json({pluginId:'sample',version:'2.0.0',state:runtime,healthy:runtime==='ACTIVE',lastError:null})
 if(p.endsWith('/events/backlog'))return json({pending:2,failed:1,deadLetter:0})
 if(p.endsWith('/config')) {if(req.method()==='PUT'){saved=req.postDataJSON();mutations++;return json({config:{...saved,options:{...saved.options,token:'********'}},schema,secretPaths:['/options/token']})} return json({config,schema,secretPaths:['/options/token']})}
 if(p.includes('/__ui/')){htmlFetches++;assert.equal(req.headers()['x-requested-with'],'XMLHttpRequest');return route.fulfill({contentType:'text/html',body:html})}
 if(p==='/api/plugins/sample/status'){bridgeReads++;return json({count:7})}
 if(p.endsWith('/deactivate')){runtime='DISABLED';mutations++;return json(plugin())}
 if(p==='/api/admin/plugins/sample' && req.method()==='DELETE'){mutations++;return json({success:true})}
 return json(plugin())
}
if(preview){console.log(`Plugin UI fixture preview: ${base} (?lang=zh for Chinese); isolated fixtures, not backend integration`);await new Promise(()=>{})}
await context.route('**/api/**',handleApiRoute)
const page=await context.newPage()
const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message))
try {
 await page.goto(base)
 await page.getByRole('button',{name:'Check health',exact:true}).click();await page.getByRole('button',{name:'Check health',exact:true}).waitFor();assert.ok(requests.some(r=>r.path.endsWith('/health')));checks.push('health probe loads and refreshes DTO health without sudo')
 await page.getByRole('button',{name:'Details & configuration'}).click()
 await page.getByLabel('label *',{exact:true}).fill('Changed')
 await page.getByLabel('limit *',{exact:true}).fill('70');assert.equal(await page.getByRole('button',{name:'Save configuration'}).isDisabled(),true);await page.getByLabel('limit *',{exact:true}).fill('7')
 await page.getByRole('button',{name:'Add',exact:true}).click();await page.getByLabel('ports 2 *',{exact:true}).fill('9090');await page.getByRole('button',{name:'Remove 2',exact:true}).click()
 await page.getByRole('switch').click()
 await page.getByLabel('mode *',{exact:true}).selectOption('1')
 await page.getByRole('button',{name:'Save configuration'}).click()
 await page.locator('input[type=password]').fill('test-password')
 await page.locator('form').filter({has:page.locator('input[type=password]')}).locator('button[type=submit]').click()
 await page.waitForFunction(()=>!document.querySelector('input[type=password]'))
 await page.getByRole('button',{name:'Save configuration'}).waitFor({state:'visible'})
 assert.equal(saved.options.limit,7);assert.equal(saved.enabled,false);assert.equal(saved.mode,'audit');assert.equal(saved.options.token,'********');checks.push('recursive schema/number/enum/toggle + real sudo modal keep-secret save')
 await page.getByLabel('token · Secret (masked)').selectOption('clear')
 await page.getByRole('button',{name:'Save configuration'}).click()
 await page.waitForTimeout(100)
 assert.equal(saved.options.token,null);checks.push('secret explicit null clear')
 await page.getByLabel('token · Secret (masked)').selectOption('replace')
 await page.getByRole('textbox',{name:'token',exact:true}).count().catch(()=>0)
 await page.locator('input[type=password]').fill('replacement-secret')
 await page.getByRole('button',{name:'Save configuration'}).click()
 await page.waitForTimeout(100)
 assert.equal(saved.options.token,'replacement-secret');assert.equal(await page.locator('input[type=password]').count(),0);checks.push('secret replacement masked again after save')
 for(const slot of ['admin.sidebar','admin.dashboard','admin.detail']){await page.locator(`[data-plugin-slot="${slot}"] iframe`).waitFor();assert.equal(await page.locator(`[data-plugin-slot="${slot}"] iframe`).count(),1);await page.frameLocator(`iframe[title="sample ${slot}"]`).getByText(`Sandbox ready: ${slot}`).waitFor()}
 await page.frameLocator('iframe[title="sample admin.detail"]').getByText('Sandbox ready: admin.detail').waitFor()
 assert.equal(await page.locator('iframe').first().getAttribute('sandbox'),'allow-scripts');assert.equal(await page.locator('iframe').first().getAttribute('src'),null)
 checks.push('three distinct slot mounts + authenticated HTML fetch + srcDoc opaque sandbox')
 await page.locator('button[aria-label="Close"]').count()
 await page.waitForTimeout(3200)
 for(const [width,height,name] of [[1280,1100,'desktop'],[360,1100,'mobile']]){await page.setViewportSize({width,height});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);for(const iframe of await page.locator('iframe:visible').all())await iframe.scrollIntoViewIfNeeded();await page.evaluate(()=>window.scrollTo(0,0));await page.setViewportSize({width,height:await page.evaluate(()=>Math.max(1100,document.documentElement.scrollHeight))});for(const iframe of await page.locator('iframe:visible').all()){const frame=await iframe.contentFrame();await frame.getByText(/Sandbox ready:/).waitFor()}await page.screenshot({path:path.join(output,`${name}.png`),fullPage:true})}
 checks.push('360px/1280px real rendered screenshots, zero page overflow')
 await page.getByRole('button',{name:'Deactivate',exact:true}).click();await page.getByRole('button',{name:'Delete plugin',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Delete plugin'}).click();await page.waitForTimeout(100);checks.push('deactivate then confirmed sudo-gated remove')
 role='ADMIN';await page.reload();await page.getByRole('button',{name:'Details & configuration'}).click();await page.getByRole('switch').waitFor();assert.equal(await page.getByRole('button',{name:'Save configuration'}).count(),0);assert.equal(await page.getByRole('button',{name:'Delete plugin'}).count(),0);assert.equal(await page.getByRole('switch').isDisabled(),true);checks.push('ADMIN read-only without mutation controls')
 role='MODERATOR';await page.reload();await page.getByText('Not Found',{exact:false}).first().waitFor({timeout:5000}).catch(()=>undefined);assert.equal(await page.getByRole('button',{name:'Details & configuration'}).count(),0);checks.push('MODERATOR client has no plugin controls (real server guard separately executed)')
 role='SUPER_ADMIN';runtime='ACTIVE';await page.goto(`${base}/?bridge=1`)
 const frame=page.frameLocator('iframe');await frame.getByText('Sandbox ready: admin.detail').waitFor()
 const child=page.frames().find(f=>f.url()==='about:srcdoc');assert.ok(child)
 assert.equal(await child.evaluate(()=>window.storageBlocked),true)
 await child.evaluate(()=>window.bridge.postMessage({type:'myndbbs:plugin:request',nonce:window.nonce,id:'good',method:'GET',path:'/status'}))
 await child.waitForFunction(()=>window.lastReply?.id==='good');assert.equal((await child.evaluate(()=>window.lastReply)).data.count,7)
 for(const [id,method,pathValue] of [['wrong-plugin','GET','/../other/status'],['write','POST','/status'],['undeclared','GET','/unknown']]){await child.evaluate(({id,method,pathValue})=>window.bridge.postMessage({type:'myndbbs:plugin:request',nonce:window.nonce,id,method,path:pathValue}),{id,method,pathValue});await child.waitForFunction(id=>window.lastReply?.id===id,id);assert.equal((await child.evaluate(()=>window.lastReply)).error,'ERR_PLUGIN_BRIDGE_DENIED')}
 assert.equal(bridgeReads,1)
 await page.locator('iframe').dispatchEvent('load');assert.equal(await child.evaluate(()=>window.initCount),1)
 assert.equal(await child.evaluate(async()=>{try{await fetch('/api/escape');return false}catch{return true}}),true)
 checks.push('nonce MessageChannel GET allowlist; cross-plugin/write/undeclared denied; connect-src none; one init')
 await child.evaluate(()=>window.bridge.postMessage({type:'myndbbs:plugin:request',nonce:'wrong',id:'forged',method:'GET',path:'/status'}));await page.waitForTimeout(80);assert.equal(bridgeReads,1)
 await page.evaluate(()=>window.unmountPluginSmoke());assert.equal(await page.locator('iframe').count(),0);assert.ok(await page.evaluate(()=>window.closedPorts>=2));checks.push('wrong nonce ignored; both MessagePorts closed on unmount')
 await page.goto('about:blank');await page.goto(`${base}/?lang=zh`);await page.setViewportSize({width:1280,height:1100});await page.getByRole('button',{name:'详情与配置'}).click();await page.getByRole('switch').waitFor();await page.evaluate(()=>document.documentElement.classList.add('dark'));for(const iframe of await page.locator('iframe:visible').all())await iframe.scrollIntoViewIfNeeded();await page.evaluate(()=>window.scrollTo(0,0));await page.setViewportSize({width:1280,height:await page.evaluate(()=>document.documentElement.scrollHeight)});for(const slot of ['admin.sidebar','admin.dashboard','admin.detail'])await page.frameLocator(`iframe[title="sample ${slot}"]`).getByText(`Sandbox ready: ${slot}`).waitFor();await page.screenshot({path:path.join(output,'desktop-zh-dark.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);checks.push('Chinese dark theme screenshot')
 runtime='ROLLED_BACK';await page.goto(`${base}/?rolled=1`);await page.setViewportSize({width:1280,height:1100});await page.getByRole('button',{name:'Details & configuration'}).click()
 const readsBeforeSlots=bridgeReads
 for(const slot of ['admin.sidebar','admin.dashboard','admin.detail']) {
  const iframe=page.locator(`iframe[title="sample ${slot}"]`);await iframe.waitFor();await page.frameLocator(`iframe[title="sample ${slot}"]`).getByText(`Sandbox ready: ${slot}`).waitFor()
  const element=await iframe.elementHandle(), child=await element.contentFrame()
  await child.evaluate(()=>window.bridge.postMessage({type:'myndbbs:plugin:request',nonce:window.nonce,id:'dto-route',method:'GET',path:'/status'}))
  await child.waitForFunction(()=>window.lastReply?.id==='dto-route');assert.equal((await child.evaluate(()=>window.lastReply)).data.count,7)
  await child.evaluate(()=>window.bridge.postMessage({type:'myndbbs:plugin:request',nonce:window.nonce,id:'dto-write-denied',method:'GET',path:'/write-only'}))
  await child.waitForFunction(()=>window.lastReply?.id==='dto-write-denied');assert.equal((await child.evaluate(()=>window.lastReply)).error,'ERR_PLUGIN_BRIDGE_DENIED')
 }
 assert.equal(bridgeReads,readsBeforeSlots+3);checks.push('ROLLED_BACK desired ACTIVE: all 3 real PluginSlot DTO GET bridges return count 7; POST-only capabilities denied')
 for(const state of ['ROLLED_BACK','UNHEALTHY']){runtime=state;await page.reload();await page.getByRole('button',{name:'Deactivate',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Deactivate',exact:true}).isEnabled(),true);assert.equal(await page.getByRole('button',{name:'Reload',exact:true}).isEnabled(),true);assert.equal(await page.getByRole('button',{name:'Delete plugin',exact:true}).isDisabled(),true)}
 runtime='QUARANTINED';desiredOverride='DISABLED';await page.reload();await page.getByRole('button',{name:'Delete plugin',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Delete plugin',exact:true}).isEnabled(),true)
 runtime='ROLLED_BACK';await page.reload();await page.getByRole('button',{name:'Details & configuration'}).click();await page.getByRole('switch').waitFor();assert.equal(await page.locator('iframe').count(),0);checks.push('desired-state actions: UNHEALTHY/ROLLED_BACK deactivate+reload; disabled pending delete; disabled slots hidden')
 assert.deepEqual(pageErrors,[])
 const result={checks,mutations,htmlFetches,bridgeReads,pageErrors,output,base,serverClosedAfterRun:true}
 await fs.writeFile(path.join(output,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2))
} catch(error) { console.error('SMOKE_DEBUG',JSON.stringify({pageErrors,text:await page.locator('body').innerText()}));await page.screenshot({path:path.join(output,'failure.png'),fullPage:true});throw error } finally {await browser.close();await new Promise(resolve=>server.close(resolve))}
