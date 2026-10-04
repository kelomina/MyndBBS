# Bundled human-verification provider

Implementation date: 2026-10-04. Contract: `.agents/contracts/bundled-human-verification/API-SPEC.md` FROZEN v1 and RUNTIME-REVIEW.md section 7.

## Runtime contents and isolation

- This directory contains the plugin entry, configuration, manifest and standalone MJS algorithms.
- `ui/challenge.html` contains the isolated challenge UI and is served only through the declared humanVerification capability.
- Production entry exports `activate(ctx)`, `deactivate()` and `handleHumanVerification({operation,purpose,input})`.
- No core-src imports, database, Redis, HTTP, filesystem I/O, environment test flags, fixed answers, injected clock or injected RNG.
- Source is not an installed/approved release. There is no signature, signing key, trust-store change or automatic activation here.

## Interface and state

- `issue`: exact empty input `{}`; output `{challengeId,challenge,expiresInSec:300}`.
- `verify`: exact `{challengeId,solution}`; output `{verified,assurance}`. No proof token is minted by the plugin.
- Purposes are registration/post/comment/friendRequest/rateLimitUnlock; only rateLimitUnlock uses federal kind selection.
- Four business purposes always use slider. Explicit federal.enabled=false chooses slider at configured sliderStrength, never a fault fallback.
- Core owns requires()/bypass policy. Even when a surface is disabled, a direct issue request generates a real challenge, never a success shortcut.
- challengeId is a random plugin-local UUID, not the browser challenge handle or the core proof token.
- State is a private Map with a hard 1024-entry cap and absolute 300-second TTL. Expired entries are removed lazily on issue/verify/health; idle retained expired entries are bounded and cannot verify.
- Capacity exhaustion rejects new issues; it does not evict a valid challenge or weaken verification.
- A matching-purpose verify synchronously removes its RAM record before algorithm work; bad answers burn it. Wrong purpose cannot consume another purpose's record.
- Restart/deactivate/reactivate loses all RAM state. Core is still solely responsible for atomic challenge/proof consumption, binding, generation/digest and recovery epoch.
- Configuration is normalized once at activate, deeply frozen, and snapshotted into each challenge. Missing fields get safe defaults; invalid values/unknown keys reject activation.
- Surface fields are optional in the manifest schema. Core defaults each omitted surface to true, matching plugin normalizeConfig; omission cannot silently disable a business gate.
- Cross-field kind rules belong only to the plugin: activate calls normalizeConfig, which rejects all kinds disabled, including when federal.enabled=false. The platform schema subset cannot express this rule; core must not duplicate federal business validation. The admin configuration store may retain a schema-valid but semantically invalid candidate. It does not become effective: failed reload/activation retains the previously active provider and generation.
- Requests have a second parsed-JSON UTF-8 32KiB/depth12 guard; issue outputs are measured before state is inserted. Runtime/control must still cap raw streams before parsing.
- Geometry returns a cloned public permutation so direct-call mutation cannot alter the private answer snapshot.

## Algorithm compatibility

The source was migrated from the pre-change backup, not imported at runtime:

| Module | Original source |
| --- | --- |
| algorithms/slider.mjs | domain/identity/CaptchaChallenge.ts |
| algorithms/geometry.mjs | domain/identity/FederalGeometry.ts |
| algorithms/pow.mjs | lib/federalPow.ts |
| algorithms/image.mjs | application/identity/SvgCaptchaGenerator.ts |

- Slider retains all low/normal/strict position, point/time and variance thresholds, plus strict target range. Its named image generator actually outputs a 318x128 PNG data URL.
- Geometry retains the 1560/130 slot interpretation, strict center deviation <=30, separate 8/10/12-point and 150/200/300ms minima, time ceilings, AND variance rules and same-stroke teleport checks.
- PoW retains one SHA-256 of `challengeHex + '|' + nonce`, MSB leading-zero bits, 128-bit random challenge and nonce length 1..256. The server never searches nonces.
- Slider/geometry return snapshot assurance; PoW returns low, independent of bits and configured sliderStrength.
- Defensive addition only: reject non-finite derived moments (finite attacker coordinates can overflow sums). Existing thresholds are not reduced or replaced. Entry also validates finite numeric DTOs and exact shapes.
- Original core repository, redeem/JWT handling, production test hooks and fallback controllers were NOT migrated.

## Targeted test evidence

Run from repository root:

```powershell
node --test "packages/backend/tests/bundled-human-verification-plugin.test.mjs"
```

2026-10-04, Node v24.20.0: 15 tests, 15 pass, 0 fail/skip; duration 233.4192ms. Only this newly added plugin suite was run; no backend build, existing suite, live DB, Docker, network service or production deployment.

Coverage includes manifest entry hash/defaults, dependency boundaries, missing/invalid config, purpose selection, real random geometry and PoW, immutable snapshots, one-winner verification, 1024 capacity, TTL boundary/restart, DTO/UTF-8/depth rejection, three-strength slider boundaries, independent geometry behavior and numeric-overflow rejection.

The initial run caught two test-fixture issues (comment text mistaken for imports and an inexact floating-point uniform-speed fixture); the checks were corrected without relaxing production algorithm thresholds. A later hardening test covers overflow.

## Packaging and integration limits

- `signatureKeyId: myndbbs-bundled-v1` is the intended key identifier only. An operator must supply the corresponding approved public key/signing process, or explicitly replace this metadata and repackage; no key is generated or trusted by this source.
- `entrySha256` covers exact index.mjs bytes; algorithm modules and final UI bytes are protected by the signed whole archive. Any change to entry requires rehash; any change to any packaged file requires a newly signed archive.
- Follow the frozen two-phase release: capability infrastructure while retaining old business implementation, approve/activate the signed provider, then cut over core/UI. This implementation performs neither phase.
- Actual core Redis atomicity, generation/digest revocation, metadata checks, limited-stream runtime transport, UI integration/browser acceptance and signed deployment are outside the acceptance scope of this plugin unit smoke.
