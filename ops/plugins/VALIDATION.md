# Plugin v2 DevOps targeted validation — 2026-10-02

cwd: repository root; Windows PowerShell; no Docker, deployment, push, CI dispatch, or full regression.

## Actual checks

- `node --check scripts/package-plugin-release.mjs`: exit 0.
- `node --check ops/plugins/smoke-package.mjs`: exit 0.
- `node --check ops/plugins/example/entry.mjs`: exit 0.
- `bash -n scripts/install-plugin-release.sh scripts/ensure-hot-update-base.sh`: exit 0; both files contain LF only.
- `bash scripts/install-plugin-release.sh`: expected exit 64; only prints direct-install-disabled / admin-approval instructions, no Docker or state writes.
- `node ops/plugins/smoke-package.mjs`: exit 0, status PASS; 15 named checks; archive files=2, binary signature=64 bytes, fixture value=42. Exact LF signature envelope, deterministic repeated output, wrong/untrusted key, short signature, RSA/Ed448, wrong key ID, output overwrite/in-source output, secret filename, and entry tamper guards covered. CLI emits three nonempty files and no private key.
- Smoke artifacts were written to an OS temporary directory. Ephemeral signing keys remained in memory; generated artifacts were not committed.
- Targeted `python -X utf8 -` + PyYAML/static assertions: 4 YAML files parsed; 10 workflow `run` blocks passed Git Bash `-n`; plugin deploy job absent; only frontend/core deploy jobs remain; plugin build has no SSH/control/runtime credential; socket only on supervisor; internal runtime network only on supervisor; backend read-only manifest bind; host artifact/trust paths mapped; rolling Compose has no duplicate supervisor; all Dockerfile COPY sources exist.
- Targeted preservation comparison (`git show HEAD:...` read only): four frontend/core job objects unchanged; original `packages/backend/.env.example` content is an unchanged prefix.
- `Test-Path -PathType Leaf` + `Get-Content` + size checks: all 15 delivered source/doc/example files exist and are nonempty (inventory in HANDOVER).

## Corrections during validation

Two helper invocations initially failed before successful reruns: Python used the Windows GBK default (fixed by `-X utf8`), and PowerShell rejected piping a bare foreach statement (fixed by collecting the inventory then piping). These were local helper failures, not successful validation claims; all checks above describe the successful reruns.

## Not verified / not authorized

No Docker image build, Compose engine config/profile resolution, network reachability, supervisor runtime activation, authenticated admin upload/approval flow, production health/public reachability, or rollback drill. No real key provisioned and no CI environment created. Static isolation checks are not a container-level isolation proof. The dual-homed supervisor remains reachable from runtime IPs; main-owned control authentication must reject all non-control tokens. A real Docker environment and QA are still required before release approval.

## Rollback / handoff

Keep all unrelated/user edits. Do not reset the workspace to HEAD. Revert only this delivery's reviewed hunks if necessary. Deployed plugin rollback must use SUPER_ADMIN+sudo and the supervisor's approved version/digest flow; do not restore the direct-install bypass. Future infrastructure rollback requires backup image IDs/immutable tags, Compose/state/config backups and preservation of .env/data volumes. Full procedure and trust-key rotation are in `ops/plugins/README.md`.

## Main-thread integrated smoke (2026-10-02)

From the repository root, execute `./scripts/smoke-plugin-platform.ps1`. This aggregate is a targeted suite, not the repository-wide regression.

- Backend Prisma client generation and TypeScript build: exit 0.
- Plugin-only Jest: 6 suites, 65/65 passed.
- Actual HTTP backend API + external runtime/supervisor + contract parity: 21/21 passed; DB/session infrastructure and Docker runtime adapter are fixtures.
- Offline signed package: 15 checks passed; 2 archive files, 64-byte signature, fixture output 42.
- Frontend TypeScript: exit 0.
- Actual React admin UI: 15 checks passed, zero page errors; 360px mobile, 1280px desktop and Chinese dark-mode screenshots inspected. API responses are fixture data, not production results.
- An initial manager assertion differed only because Windows realpath expands the TEMP 8.3 alias. The assertion now compares canonical real paths; the full targeted aggregate was rerun successfully.

No migration was applied; no actual PostgreSQL/Redis/Docker integration, CI dispatch, production deployment, or real trust-key provisioning was performed. DB callback write failures have runtime compensation, but DB COMMIT acknowledgement failures/process crashes still need operator reconciliation; this is not a distributed atomic transaction.

Final integration corrections: ROLLED_BACK remains eligible for event subscriptions and all admin UI slots; manifest GET capabilities now reach sidebar/dashboard/detail MessageChannels; unhealthy/rolled-back instances retain stop/reload actions and disabled pending uploads may be deleted. The aggregate above was rerun successfully after these corrections. Strict YAML/socket smoke (4 files) is now included; the QA-discovered duplicate PLUGIN_DOCKER_TRUST_KEYS_FILE in Compose and its generator has been removed.

Independent QA re-ran the rendered UI smoke, inspected its own desktop/mobile/Chinese screenshots, closed QA-V2-001 and signed APPROVED for local implementation + targeted API/UI/host smoke only. This is not CI/deployment/production approval. Full report remains in .agents/contracts/plugin-platform-v2/QA-REPORT.md.

## Isolated-server follow-up (2026-10-04)

This supersedes only the earlier "not verified" claims covered below; it is not production approval.

- Real PostgreSQL / Redis / Docker runtime: 16 migrations applied in a fresh synthetic test database.
- Final targeted checks: failed candidate retention 7/7; supervisor outage 6/6; recovered health/migrations 3/3; event delivery 17/17; real Next SSR/BFF 22/22 (one record declares the HTTP-only scope). Gateway output was 42. Five test runners exited 0 with OOMKilled=false.
- Independent isolation audit: 78/78 checks. Backend has no Docker socket; workers have only the internal runtime network, read-only root and no elevated capabilities. The trusted supervisor still controls the host Docker daemon: this is not a VM security boundary.
- Earlier failures are retained in local audit records: candidate health misclassification, USER redirect rather than 404, Next overriding sandbox CSP, and test runner memory exhaustion. Targeted fixes were reverified; the initial full lifecycle was not rerun from scratch or counted twice.
- Server testing ended with 8/8 shutdown checks: all test services/workers stopped, test ports closed, production configuration hashes and core container identities unchanged; production health 200. Data and private evidence were retained locally on the test host, not committed.
- Still unverified: browser iframe rendering/MessageChannel/ambient-cookie behavior on this server, long-running/load/adversarial escape tests, full business-event E2E and production release acceptance. The event smoke accelerated test retry due-times after two actual backoffs; it did not wait all production backoff intervals.

Dated host-bound scripts, session credentials, generated signatures and raw operational evidence are deliberately excluded from the source release. Use the portable targeted smoke entrypoint above for source verification.

## Pre-push security review (2026-10-04)

A separate static review found an additional CSP classification bypass via encoded plugin UI path segments. The classifier now mirrors Next catch-all decoding and fetch URL normalization, including encoded slashes/dot segments and the backend's case-insensitive route prefix.

- `node --test --test-isolation=none packages/frontend/tests/plugin-page-guard.test.mjs`: 5/5, including nine canonical/encoded URL forms and malformed encoding handling.
- `node packages/frontend/tests/plugin-csp.http.smoke.mjs`: actual local Next proxy/catch-all/BFF HTTP on a disposable same-drive fixture, nine HTML URL forms retain sandbox/connect/form restrictions and value 42; core page policy remains unchanged. The upstream is synthetic, not a live server/browser or production test.
- The same HTTP smoke with only the previous CSP module substituted in the disposable fixture fails specifically on the encoded `__ui` URL, demonstrating that the new regression detects the original bug. Shipping sources were not reverted.
- Before the HTTP smoke could run, the test harness hit Windows cross-volume symlink/Turbopack and Webpack resolution limits. Its fixture now lives under ignored reports on the repository drive and explicitly uses Webpack. These harness failures are not counted as passing application checks.
- Backend build/Prisma generation, 20 targeted backend HTTP/control checks, the 15-check signed package smoke, frontend typecheck and targeted lint passed. Initial lint issues in test-only loader/module naming and generated-artifact exclusions were corrected. No repository-wide test regression or live deployment was run for this push.

Source hygiene: local agent env backups, private key files, generated bundles/screenshots and host-bound test scripts are excluded from Git and Docker context. Example configuration retains placeholders and overridable deployment defaults, not operator credentials or personal workstation paths.
