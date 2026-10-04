import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
const require=createRequire(import.meta.url), ts=require('typescript')
function load(file,stubs){
 const module={exports:{}}
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText,{module,exports:module.exports,require:n=>n in stubs?stubs[n]:require(n),Headers,process,crypto:globalThis.crypto,btoa})
 return module.exports
}
test('plugin admin parent layout returns notFound for USER, MODERATOR and invalid sessions',async()=>{
 let role='USER',ok=true,pathname='/admin/plugins'
 const stubs={
  'next/headers':{headers:async()=>new Headers({'x-mynd-pathname':pathname}),cookies:async()=>({getAll:()=>[]})},
  'next/navigation':{notFound:()=>{throw Error('404')},redirect:()=>{throw Error('redirect')}},
  '../../i18n/get-dictionary':{getDictionary:async()=>({})},'../../i18n/config':{defaultLocale:'en'},
  '../../lib/bff/serverApi':{serverFetch:async()=>({ok,json:async()=>({user:{role}})})},
  '../../components/plugins/PluginSlot':{},'../../components/TranslationProvider':{},
 }
 const layout=load('../src/app/admin/layout.tsx',stubs).default
 for(const r of ['USER','MODERATOR']){role=r;await assert.rejects(()=>layout({children:null}),/^Error: 404$/)}
 ok=false;await assert.rejects(()=>layout({children:null}),/^Error: 404$/)
 ok=true;role='USER';pathname='/admin/users';await assert.rejects(()=>layout({children:null}),/^Error: redirect$/)
})
test('proxy overwrites spoofed route context before it reaches server layouts',()=>{
 const {initMiddlewareContext}=load('../src/middleware/types.ts',{
  'next/server':{NextResponse:{next:({request})=>({request,headers:new Headers(),cookies:{set(){}}})}},
  '../i18n/config':{defaultLocale:'en',locales:['en','zh']},
 })
 const request={headers:new Headers({'x-mynd-pathname':'/admin/plugins'}),nextUrl:{pathname:'/admin/users'},cookies:{get(){}}}
 const context=initMiddlewareContext(request)
 assert.equal(context.response.request.headers.get('x-mynd-pathname'),'/admin/users')
})
test('generic redirect guard delegates only plugin administration to server authorization',async()=>{
 const {guardRouteAccess}=load('../src/middleware/authGuard.ts',{'next/server':{NextResponse:{redirect:()=>{throw Error('unexpected redirect')}}},'../lib/routingGuard':{matchRoute(){throw Error('unexpected whitelist')}},'./routeWhitelist':{getWhitelist(){throw Error('unexpected whitelist')}}})
 for(const pathname of ['/admin/plugins','/admin/plugins/example'])assert.equal(await guardRouteAccess({}, {pathname}),null)
})

test('proxy retains opaque sandbox CSP on plugin HTML but not core pages',()=>{
 const {applyCspHeaders}=load('../src/middleware/csp.ts',{})
 const ctx={pathname:'/api/plugins/demo/__ui/ui/sidebar.html',nonce:'core-test',response:{headers:new Headers()}}
 applyCspHeaders({},ctx)
 const pluginCsp=ctx.response.headers.get('content-security-policy')
 assert.match(pluginCsp,/^sandbox allow-scripts;/)
 assert.ok(pluginCsp.includes("connect-src 'none'"))
 assert.ok(!pluginCsp.includes('allow-same-origin')&&!pluginCsp.includes('nonce-'))
 ctx.pathname='/admin/plugins';applyCspHeaders({},ctx)
 const coreCsp=ctx.response.headers.get('content-security-policy')
 assert.ok(coreCsp.includes('nonce-core-test')&&!coreCsp.includes('sandbox'))
})
