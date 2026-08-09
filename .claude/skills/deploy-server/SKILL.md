---
name: deploy-server
description: Package the MyndBBS monorepo into a source tar, upload it to the production server, build the backend/frontend Docker images there, and upgrade the running compose stack. Use whenever the user asks to deploy to the server.
---

# Deploy MyndBBS to the production server

Deploy the current working tree to the production server at
`myndops@8.148.210.186:2207`. The flow is: verify locally → package a source
tar → upload → back up the running deployment → build images server-side →
`docker compose up -d` → health-check. This keeps the live stack untouched
until a verified image is ready, and leaves a rollback snapshot behind.

## Environment facts (verify against memory `server-deploy-infra`)

- SSH: alias `myndbbs-ops` (user `myndops`, port 2207). Root login is denied;
  every root/docker command must be prefixed `sudo -n`. Batch mode:
  `ssh -o BatchMode=yes -o ConnectTimeout=15 myndbbs-ops`.
- Server resources: ~1.8GB RAM, **no swap by default**, ~40G disk. Builds are
  memory- and disk-hungry — expect OOM pressure and manage resources first
  (see *Resource management* below).
- Deploy layout: compose file `/opt/myndbbs/docker-compose.yml`; builds
  extracted to `/opt/myndbbs/builds/<name>/`; rollback snapshots in
  `/opt/myndbbs/backup/<timestamp>-<label>/`.
- The box hosts **other services** (vaultwarden, adguard, kolostudio-unified-auth,
  mysql, 1panel, meilisearch…). Only ever build/restart the `myndbbs-*`
  containers; never prune or remove other services' images/volumes.
- postgres/redis data volumes must never be touched; OOM-killed app containers
  auto-recover via `restart: unless-stopped`, but postgres/redis must be
  protected with a swap file during heavy builds.

## Step 1 — Verify locally before touching the server

Run the checks that gate a deploy. All must pass:

```bash
pnpm exec tsc --noEmit                         # in each package, or pnpm -r
cd packages/frontend && node --test tests/     # math rendering + any node:test suites
cd packages/backend  && pnpm exec jest         # backend jest suites
pnpm --filter frontend build                   # Next.js production build (optional but safest)
```

Fix anything that fails before packaging.

## Step 2 — Package the source tar

From the repo root, tar the source excluding build/SCM/sensitive dirs. `*.py`
and `data/` are excluded because the server has its own copies:

```bash
mkdir -p deploy-artifacts
tar --exclude='.git' --exclude='.next' --exclude='node_modules' \
    --exclude='deploy-artifacts' --exclude='*.tar' --exclude='*.py' \
    --exclude='data' --exclude='.claude' --exclude='.env*' \
    -czf "deploy-artifacts/myndbbs-$(date +%Y%m%d)-<label>.tar" .
```

Confirm the tar is a few MB (source only — ~15MB). Upload:

```bash
scp deploy-artifacts/myndbbs-$(date +%Y%m%d)-<label>.tar myndbbs-ops:/tmp/
```

## Step 3 — Extract on the server

```bash
ssh myndbbs-ops "sudo mkdir -p /opt/myndbbs/builds/<name> && \
  sudo tar -xzf /tmp/myndbbs-<date>-<label>.tar -C /opt/myndbbs/builds/<name>/"
```

Use a descriptive `<name>` (e.g. `<sha>-<feature>`).

## Step 4 — Back up the currently-running deployment (rollback)

Always snapshot the live images + DB dump + compose file **before** building,
so the deploy is reversible:

```bash
ssh myndbbs-ops "sudo bash -s" <<'EOF'
set -e
TS=$(date +%Y%m%d-%H%M%S)
LABEL="<label>"
BK="/opt/myndbbs/backup/${TS}-${LABEL}"
sudo mkdir -p "$BK"
cd /opt/myndbbs
sudo docker save myndbbs-backend:deploy  -o "$BK/backend.tar"
sudo docker save myndbbs-frontend:deploy -o "$BK/frontend.tar"
sudo docker compose exec -T postgres pg_dump -U myndbbs myndbbs > "$BK/db_dump.sql"
sudo cp docker-compose.yml "$BK/"
echo "backup -> $BK"
EOF
```

`docker save` on this box is slow (I/O bound) — run it with a generous timeout.

## Step 5 — Build images (server-side)

The **backend** Dockerfile runs `apk add python3 make g++`, which is unusably
slow from the China server; patch it to the aliyun mirror. The **frontend**
Dockerfile needs no mirror patch.

```bash
# Backend — insert the aliyun mirror right after the builder FROM line
sed 's|^FROM node:22-alpine AS builder|FROM node:22-alpine AS builder\nRUN sed -i '\''s/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g'\'' /etc/apk/repositories|' \
    packages/backend/Dockerfile > /tmp/Dockerfile.myndbbs-backend
sudo docker build -t myndbbs-backend:deploy -f /tmp/Dockerfile.myndbbs-backend .

# Frontend
sudo docker build -t myndbbs-frontend:deploy -f packages/frontend/Dockerfile .
```

Run builds with `nohup ... > /tmp/build-<svc>-<date>.log 2>&1 &` so they
survive the SSH disconnect, then poll the log. Keep the SSH session that
launches the build short — a foreground `ssh` will hang until the backgrounded
build closes the channel.

## Step 6 — Deploy

```bash
ssh myndbbs-ops "cd /opt/myndbbs && sudo docker compose up -d"
```

Only the services whose image tag changed get recreated; postgres/redis stay up.

## Step 7 — Health-check

```bash
sudo docker compose -f /opt/myndbbs/docker-compose.yml ps     # all Up, backend/frontend healthy
curl -s http://127.0.0.1:3001/api/health                       # {"status":"ok","app":"MyndBBS"}
# From outside: curl -I https://kolobbs.kolostudio.fun         # 200
```

For feature-specific verification (e.g. KaTeX math), fetch a real page through
the reverse proxy and assert markers:
```bash
curl -s --compressed <public-post-url> | grep -c 'katex-html'   # > 0 means SSR math rendered
```

## Rollback

```bash
ssh myndbbs-ops "sudo bash -s" <<'EOF'
BK="/opt/myndbbs/backup/<ts>-<label>"
sudo docker load -i "$BK/backend.tar"
sudo docker load -i "$BK/frontend.tar"
cd /opt/myndbbs && sudo docker compose up -d
sudo docker compose exec -T postgres psql -U myndbbs myndbbs < "$BK/db_dump.sql"
EOF
```

## Resource management (disk / memory / OOM)

The frontend `next build` and backend `tsc` easily exhaust 1.8GB RAM. The
OOM killer historically targets the running app containers (which restart
automatically) — never postgres/redis — but don't rely on luck:

1. **Check before building**: `df -h /opt` (need ~3–4GB headroom) and
   `free -m`.
2. **Create swap when low**: a 2GB `/swapfile` protects the DB during builds.
   It is not in fstab, so re-create it for each heavy build:
   ```bash
   sudo dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none \
     && sudo chmod 600 /swapfile && sudo mkswap /swapfile >/dev/null \
     && sudo swapon /swapfile
   ```
3. **Disk**: if free space is < ~3GB, reclaim from *obsolete* backup dirs
   (`/opt/myndbbs/backup/*`). Keep the newest 2 (current rollback + prior
   deploy). These deletions are irreversible snapshots the user may not have
   authorized — **ask the user before removing any**.
4. **Do not** `docker image prune -a` or remove dangling images blindly — the
   reclaimable 2GB+ in `docker system df` includes other services' old tags.

## Safety constraints

- Never delete or modify `/opt/myndbbs/data/` (postgres bind mount) or any
  `*-data` volumes.
- Never touch/restart non-`myndbbs-*` containers or images.
- All root/docker ops go through `sudo -n`; use BatchMode SSH and short,
  single-purpose commands.
- Report deployment results faithfully: exact image IDs, container status,
  health-check output, and anything that was skipped or OOM-restarted.
