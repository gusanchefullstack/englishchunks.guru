# Deployment runbook

Production layout: **web** on Vercel, **database** on Neon, **scoring** on one DigitalOcean Droplet behind Caddy. No secret ever goes into the repo. Every value below lives only in the Vercel project env, `/etc/ec-scoring.env` or `/etc/ec-cron.env` on the Droplet, or your password manager.

## 1. Neon (database)

1. Create the project (region close to Vercel's function region, e.g. `aws-us-east-1`). The default branch is `main` (production). Create a `staging` branch from it.
2. Copy the **pooled** connection string for each branch (`…-pooler…/neondb?sslmode=require`).
3. Run the migrations and seed from your machine against each branch:

   ```bash
   cd web
   DATABASE_URL='<neon url>' pnpm db:migrate
   DATABASE_URL='<neon url>' pnpm db:seed        # voices, sound hints, starter chunks
   ```

4. Optional: grow the library (needs `AI_GATEWAY_API_KEY`, ~$1–3 of LLM calls): `DATABASE_URL=… pnpm seed:library`.

## 2. Scoring Droplet

### 2.1 Create it

- Ubuntu 24.04 LTS, **Basic 4 GB / 2 vCPU**. Regular `s-2vcpu-4gb` ($24/mo) is not offered in every region (not in SFO3); there use `s-2vcpu-4gb-amd` ($28/mo). Add your SSH key. Production: `ec-scoring`, SFO3, AMD.
- DNS: `A scoring.englishchunks.guru → <droplet IP>`.

```bash
ssh root@<ip>
apt-get update && apt-get -y upgrade && apt-get -y install unattended-upgrades ufw
ufw default deny incoming && ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw --force enable
# 8001 is published on 127.0.0.1 only (Docker bypasses ufw for published ports, so never publish it on 0.0.0.0)
printf 'PasswordAuthentication no\nKbdInteractiveAuthentication no\nPermitRootLogin prohibit-password\n' > /etc/ssh/sshd_config.d/10-hardening.conf
sshd -t && systemctl reload ssh
```

### 2.2 Install Docker and Caddy

```bash
curl -fsSL https://get.docker.com | sh
apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt-get update && apt-get install -y caddy
```

### 2.3 Models (~950 MB, built once on your machine)

The wav2vec2 export needs PyTorch, so do it locally and copy the result:

```bash
ssh root@<ip> mkdir -p /opt/ec-scoring/models
# on your machine
cd scoring
uv run python -m scoring.models.download
uv run --extra export python -m scoring.models.download --wav2vec2
rsync -az models/ root@<ip>:/opt/ec-scoring/models/   # macOS openrsync: no --info/--progress2
# verify: compare `shasum -a 256` locally with `sha256sum` on the droplet
# on the droplet
chown -R 10001:10001 /opt/ec-scoring/models && chmod -R a-w /opt/ec-scoring/models
```

### 2.4 Image

Ship only committed files (never `.env`, never models):

```bash
# on your machine
git archive --format=tar HEAD scoring web/src/content/sound-hints.json | gzip > /tmp/ec-src.tgz
scp /tmp/ec-src.tgz root@<ip>:/tmp/
# on the droplet
rm -rf /opt/ec-scoring/src && mkdir -p /opt/ec-scoring/src && tar -xzf /tmp/ec-src.tgz -C /opt/ec-scoring/src
cd /opt/ec-scoring/src && docker build -f scoring/deploy/Dockerfile -t ec-scoring:<sha> -t ec-scoring:latest .
```

(Once the repo is on GitHub, `git clone` works too.)

### 2.5 Secrets

Generate them **on the droplet** so they never pass through a terminal or chat:

```bash
umask 077
printf 'SCORING_SHARED_SECRET=%s\n' "$(openssl rand -hex 32)" > /etc/ec-scoring.env
printf 'APP_URL=https://englishchunks.guru\nCRON_SECRET=%s\n' "$(openssl rand -hex 32)" > /etc/ec-cron.env
```

Copy them to Vercel by piping, never by pasting (from your machine, in `web/`):

```bash
ssh root@<ip> "sed -n 's/^SCORING_SHARED_SECRET=//p' /etc/ec-scoring.env" | tr -d '\n' | vercel env add SCORING_SHARED_SECRET production
ssh root@<ip> "sed -n 's/^CRON_SECRET=//p' /etc/ec-cron.env" | tr -d '\n' | vercel env add CRON_SECRET production
```

### 2.6 Services

```bash
cp scoring/deploy/scoring.service scoring/deploy/cron-hourly.service scoring/deploy/cron-hourly.timer /etc/systemd/system/
cp scoring/deploy/Caddyfile /etc/caddy/Caddyfile
mkdir -p /var/log/caddy && chown caddy:caddy /var/log/caddy
# don't run `caddy validate` as root here: it creates scoring.log owned by root and the reload then fails
systemctl daemon-reload
systemctl enable --now scoring.service
systemctl reload caddy
# only after the web app is deployed (otherwise it fails hourly):
systemctl enable --now cron-hourly.timer
```

### 2.7 Verify

```bash
curl -s localhost:8001/healthz                     # models true once preloaded (~7 s on SFO3 AMD)
curl -s https://scoring.englishchunks.guru/healthz # valid TLS
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://scoring.englishchunks.guru/v1/score   # 401 (unsigned)
systemctl list-timers cron-hourly.timer
journalctl -u scoring -n 50 --no-pager            # no audio, no transcripts in logs
docker exec ec-scoring find /tmp -type f           # only phonemizer's libespeak-ng copies, never audio
# signed end-to-end test inside the container (secret stays on the host):
docker exec -i ec-scoring /app/.venv/bin/python - < /opt/ec-scoring/src/scoring/deploy/smoke_test.py
```

First production run (2026-10-17, SFO3 AMD, 20 synthetic clips): p50 1.43 s, p95 1.84 s, container memory 1.4 GB. The real-device check (`pnpm --filter web latency:check`) runs after the web deploy and is recorded in `web/docs/latency.md`.

### 2.8 Update / roll back

```bash
cd /opt/ec-scoring/src && git pull
docker build -f scoring/deploy/Dockerfile -t ec-scoring:$(git rev-parse --short HEAD) -t ec-scoring:latest .
systemctl restart scoring
# Roll back: docker tag ec-scoring:<previous sha> ec-scoring:latest && systemctl restart scoring
```

Rotate `SCORING_SHARED_SECRET`: write the new value to `/etc/ec-scoring.env` and `systemctl restart scoring`, then immediately update it in Vercel and redeploy. Attempts in between fail signature checks and show learners the "try again" message; no data is lost.

## 3. Vercel (web)

1. Import the GitHub repo, **Root Directory `web`**, framework Next.js, plan **Hobby** while testing (Pro before charging money: Hobby is non-commercial).
2. Add every variable from the README's Configuration table for **Production** and **Preview** (Preview → Neon `staging` branch). The `SPACES_*` values must exist at **build** time (CSP).
3. `BETTER_AUTH_URL` = the production URL; add the same origin to the Google OAuth client's authorized redirect URIs (`/api/auth/callback/google`).
4. Resend: verify the sending domain (SPF, DKIM, DMARC) before setting `EMAIL_FROM`.
5. DigitalOcean Spaces: create the bucket with file listing **restricted** and enable its CDN. The app sets the ACL per object on upload (`public-read` for shared TTS audio and avatars, `private` otherwise), so no bucket-wide public policy is needed; CORS isn't either (audio and images load by URL).
6. Deploy; `vercel.json` registers the daily cron (`/api/cron/daily`). The hourly cron comes from the Droplet timer.
7. Create the first admin: sign up normally, then in Neon SQL: `update "user" set role = 'admin' where email = '<you>';`

## 4. Staging validation

Run the scenarios V1–V17 in [`specs/001-chunk-learning-app/quickstart.md`](../../specs/001-chunk-learning-app/quickstart.md) against the Preview deployment, plus:

- Lighthouse on `/`, `/today`, `/progress` (mobile, LCP ≤ 2.5 s) → `web/docs/performance.md`
- One real recording each from iOS Safari and Android Chrome (T048) → `scoring/BENCHMARKS.md`

## 5. Going live with payments

Billing stays off until an admin types `ACTIVATE` in Admin → Settings. Do it only after the go-live checklist in the quickstart: Stripe test-mode run (subscribe, renew with a test clock, cancel, failed payment), Vercel Pro, **restricted** live key (`rk_live_…`, permissions: Customers, Checkout Sessions, Customer Portal, Subscriptions, Prices read) in Vercel env only, webhook endpoint `https://englishchunks.guru/api/webhooks/stripe` with its signing secret, and a decision on Stripe Tax (it stays off unless you have an active tax registration).
