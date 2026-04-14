# Security Best Practices Report

## Executive Summary
A comprehensive security review of the `@myndbbs/backend` (Express) and `@myndbbs/frontend` (Next.js) applications was performed. Overall, the codebase uses strong foundational components (Argon2 for passwords, proper Cookie flags, Prisma ORM mitigating SQL injections, and React/Next.js mitigating raw HTML injection). However, a few critical and high-severity security issues were identified—most notably related to Cross-Site Request Forgery (CSRF), IP spoofing in the rate limiter, and missing Security Headers in the Next.js frontend.

---

## Findings

### 1. Missing CSRF Protection on Cookie-Authenticated Endpoints (EXPRESS-CSRF-001)
**Severity:** High
**Location:** `backend/src/routes/auth.ts`, `backend/src/routes/post.ts`, `backend/src/index.ts`
**Evidence:** The backend relies on `accessToken` cookies for authentication. The frontend passes `credentials: 'include'` on all `fetcher` requests. However, there is no CSRF token mechanism nor a strict custom header requirement (like `X-Requested-With: XMLHttpRequest`) implemented on state-changing endpoints (POST, PUT, DELETE).
**Impact:** Attackers could trick an authenticated user's browser into issuing state-changing requests (like deleting posts or changing settings) by hosting a malicious `<form>` on a third-party domain.
**Fix:** Introduce a custom header requirement for all state-changing API requests. Because modern browsers execute CORS preflight requests for custom headers, an attacker cannot force the browser to send this custom header across origins without explicit CORS permission.
**Mitigation:** The `cors` middleware currently rejects unknown origins, but standard `application/x-www-form-urlencoded` forms bypass CORS preflight. Adding the custom header requirement closes this gap.

### 2. Insecure IP Extraction for Rate Limiting (EXPRESS-PROXY-001)
**Severity:** High (Resolved during audit)
**Location:** `backend/src/lib/rateLimit.ts:8`
**Evidence:** 
```typescript
const getClientIp = (req: Request, res: any): string => {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    // Manually extracting the first IP...
```
**Impact:** An attacker could easily bypass the login, registration, and 2FA rate limiters by injecting spoofed IP addresses into the `X-Forwarded-For` header. The custom parser prioritized the attacker's spoofed IP instead of relying on the proxy chain.
**Fix:** The code was modified to use `req.ip`, which properly respects Express's `trust proxy` settings and uses the verified remote address.

### 3. Missing Content Security Policy (CSP) and Security Headers on Frontend (NEXT-HEADERS-001 / NEXT-CSP-001)
**Severity:** Medium
**Location:** `frontend/next.config.ts`
**Evidence:** The frontend Next.js application does not define `Content-Security-Policy`, `X-Content-Type-Options`, or `X-Frame-Options` headers in its configuration.
**Impact:** Lack of CSP leaves the application more vulnerable to Cross-Site Scripting (XSS) if an injection vulnerability is ever introduced. Lack of frame-ancestors could allow clickjacking attacks.
**Fix:** Define a baseline `headers()` function in `next.config.ts` that includes a restrictive CSP (avoiding `unsafe-inline` where possible), `X-Content-Type-Options: nosniff`, and `X-Frame-Options: DENY` (or CSP `frame-ancestors`).

### 4. Static Serving of Uploaded Files as Active Content (EXPRESS-STATIC-001)
**Severity:** Low / Medium
**Location:** `backend/src/index.ts:115`
**Evidence:** `app.use('/uploads', express.static(require('path').join(process.cwd(), 'uploads')));`
**Impact:** Serving user-uploaded files via `express.static` directly on the API domain can lead to Stored XSS if the user uploads HTML or SVG files.
**Mitigation:** The current upload controller (`backend/src/controllers/upload.ts`) mitigates this strongly by appending a `.enc` extension to all uploaded files, preventing browsers from rendering them as active HTML.
**Fix:** For defense-in-depth, configure the `/uploads` route to send a `Content-Disposition: attachment` header or enforce a strict `Content-Security-Policy` header on static files.

### 5. Missing Centralized Error Handler (EXPRESS-ERROR-001)
**Severity:** Low
**Location:** `backend/src/index.ts`
**Evidence:** There is no final `app.use((err, req, res, next) => { ... })` middleware defined.
**Impact:** Unhandled errors may cause the default Express error handler to leak stack traces in non-production environments and lacks standardized JSON structure for API clients.
**Fix:** Add a catch-all error handling middleware at the bottom of `backend/src/index.ts` to log errors internally and return a generic `500 Internal Server Error` JSON response.

---

## Next Steps
I have already applied the fix for **Finding #2 (IP Spoofing in Rate Limiter)** during the audit. I am ready to implement fixes for the remaining findings. Please let me know if you would like me to proceed with applying these security fixes to the codebase!