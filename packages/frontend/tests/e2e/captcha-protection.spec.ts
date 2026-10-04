import {expect,test} from '@playwright/test'
// Frontend fixture only; actual proof-gate/runtime acceptance belongs to backend smoke.
for(const available of [false,true]) test('registration neutral requirements: available='+available,async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('myndbbs_cookie_consent',JSON.stringify({essential:true,analytics:false,marketing:false})))
  await page.route('**/api/v1/user/profile',route=>route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({error:'ERR_UNAUTHORIZED'})}))
  const observed:string[]=[]
  page.on('request',request=>{if(request.url().includes('/api/'))observed.push(new URL(request.url()).pathname)})
  await page.route('**/api/human-verification/requirements',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({enabled:true,available,providerId:'human-verification',surfaces:{registration:true,post:true,comment:true,friendRequest:true}})}))
  await page.route('**/api/human-verification/challenge',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'ERR_HUMAN_VERIFICATION_UNAVAILABLE'})}))
  await page.goto('/register')
  await expect(page.locator('[data-human-verification="error"]')).toBeVisible()
  await expect(page.locator('button[type="submit"]').last()).toBeDisabled()
  expect(observed.some(p=>p.startsWith('/api/v1/auth/captcha'))).toBe(false)
})
