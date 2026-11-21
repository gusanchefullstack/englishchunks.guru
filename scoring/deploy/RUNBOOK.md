# Deployment runbook

Production layout: **web** on Vercel, **database** on Neon, **scoring** on Google Cloud Run (§2C, scale-to-zero, free tier), hourly cron from Google Cloud Scheduler. The production Droplet was deleted on 2026-11-21; §2 is kept as the steps to rebuild a Droplet host if Cloud Run ever stops fitting. No secret ever goes into the repo. Every value below lives only in the Vercel project env, Google Secret Manager, GitHub Actions secrets, `/etc/ec-*.env` on a Droplet, or your password manager.

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

## 2. Scoring Droplet (alternative host, not running)

### 2.1 Create it

- Ubuntu 24.04 LTS, **Basic 4 GB / 2 vCPU**. Regular `s-2vcpu-4gb` ($24/mo) is not offered in every region (not in SFO3); there use `s-2vcpu-4gb-amd` ($28/mo). Add your SSH key. The former production Droplet was `ec-scoring`, SFO3, AMD (2026-10-17 → 2026-11-21).
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

## 2C. Scoring on Google Cloud Run (production since 2026-11)

Same image contents and models as §2, but the int8 models are baked in (`scoring/deploy/Dockerfile.cloudrun`) and the service scales to zero. Free-tier sized: one score ≈ 3 vCPU-s; the monthly free grant is 180,000 vCPU-s / 360,000 GiB-s / 2 M requests. Artifact Registry keeps the 2 newest images (~$0.15/mo above its 0.5 GB free tier).

One-time setup (project `englishchunks-scoring`, billing linked, $1 budget alert):

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com secretmanager.googleapis.com
gcloud artifacts repositories create scoring --repository-format=docker --location=us-central1
gcloud artifacts repositories set-cleanup-policies scoring --location=us-central1 --policy=<keep 2 newest>.json --no-dry-run
gcloud iam service-accounts create ec-scoring-run
# Secret generated straight into Secret Manager, never printed:
openssl rand -hex 32 | tr -d '\n' | gcloud secrets create scoring-shared-secret --data-file=-
gcloud secrets add-iam-policy-binding scoring-shared-secret \
  --member=serviceAccount:ec-scoring-run@englishchunks-scoring.iam.gserviceaccount.com --role=roles/secretmanager.secretAccessor
# Build uploads are copies of the models: auto-delete after a day.
gcloud storage buckets update gs://englishchunks-scoring_cloudbuild --lifecycle-file=<delete age 1>.json
```

Build and deploy (from a clean context: committed files + the verified models, never `.env`):

```bash
SHA=$(git rev-parse --short HEAD); CTX=$(mktemp -d)
git archive HEAD scoring web/src/content/sound-hints.json | tar -x -C "$CTX"
rm -rf "$CTX/scoring/tests" && cp -R scoring/models "$CTX/scoring/models"   # compare sha256 with the reference first
cp "$CTX/scoring/deploy/Dockerfile.cloudrun" "$CTX/Dockerfile" && : > "$CTX/.gcloudignore"
gcloud builds submit "$CTX" --region=us-central1 --tag=us-central1-docker.pkg.dev/englishchunks-scoring/scoring/ec-scoring:$SHA
gcloud run deploy ec-scoring --region=us-central1 \
  --image=us-central1-docker.pkg.dev/englishchunks-scoring/scoring/ec-scoring:$SHA \
  --service-account=ec-scoring-run@englishchunks-scoring.iam.gserviceaccount.com \
  --execution-environment=gen2 --cpu=2 --memory=4Gi --cpu-boost \
  --concurrency=4 --min-instances=0 --max-instances=1 --timeout=60 \
  --set-secrets=SCORING_SHARED_SECRET=scoring-shared-secret:latest \
  --startup-probe=httpGet.path=/healthz,periodSeconds=2,timeoutSeconds=1,failureThreshold=90 \
  --allow-unauthenticated   # every route except /healthz requires the HMAC signature
```

- **gen2** loads the models in ~10 s (gen1: ~31 s). The startup probe waits on `/healthz` (503 until loaded), so requests queue instead of failing while an instance starts.
- **Concurrency 4 / max 1** mirrors the Droplet: one instance, requests processed one at a time in-process, the rest wait. `max-instances` is the spend cap (budgets only alert).
- **Cold start**: the first request after ~15 min idle takes ~18 s. The web app sends a signed `GET /v1/warm` when a learner opens a practice session, and its scoring timeout is 30 s.
- Cloud Run reserves paths ending in `z`: `/healthz` answers the probe internally but returns Google's 404 from outside. Use `/v1/warm` (signed) to check from outside.
- Verify after each deploy (from `scoring/`, secret piped from Secret Manager, never printed):
  `SCORING_SHARED_SECRET="$(gcloud secrets versions access latest --secret=scoring-shared-secret)" SCORING_URL=<service url> uv run python deploy/smoke_test.py`
- Roll back: `gcloud run services update-traffic ec-scoring --region=us-central1 --to-revisions=<previous>=100`.
- Rotate the secret: add a new version in Secret Manager, redeploy (picks up `latest`), update `SCORING_SHARED_SECRET` in Vercel and redeploy the web app.

Point the web app at it: Vercel production `SCORING_URL=<service url>` and `SCORING_SHARED_SECRET` (piped from Secret Manager into `vercel env add … --sensitive`).

## 3. Vercel (web)

1. Import the GitHub repo, **Root Directory `web`**, framework Next.js, plan **Hobby** while testing (Pro before charging money: Hobby is non-commercial).
2. Add every variable from the README's Configuration table for **Production** and **Preview** (Preview → Neon `staging` branch). `R2_ACCOUNT_ID` and `R2_BUCKET` must exist at **build** time (CSP).
3. `BETTER_AUTH_URL` = the production URL; add the same origin to the Google OAuth client's authorized redirect URIs (`/api/auth/callback/google`).
4. Resend: verify the sending domain (SPF, DKIM, DMARC) before setting `EMAIL_FROM`.
5. Cloudflare R2: create a **Standard** bucket (location hint ENAM) with public access **off**, and an API token with **Object Read & Write** on that bucket only. The bucket stays private: TTS audio is handed out as signed URLs (stable within the hour so browsers cache them), and avatars / the landing video use `/media/<key>`, which redirects to a signed URL. No CORS needed (audio and images load by URL). Free tier: 10 GB, 1M writes, 10M reads per month, no egress fees.
6. Deploy; `vercel.json` registers the daily cron (`/api/cron/daily`). The hourly cron comes from Cloud Scheduler job `cron-hourly` (project `englishchunks-scoring`, us-central1, `7 * * * *` UTC, POST with `Authorization: Bearer <CRON_SECRET>`; free tier covers 3 jobs). To rotate `CRON_SECRET`, set the same new value in Vercel production, the GitHub repo secret (used by the manual `cron-hourly.yml` run) and the job (`gcloud scheduler jobs update http cron-hourly --update-headers …`), then redeploy production.
7. Create the first admin: sign up normally, then in Neon SQL: `update "user" set role = 'admin' where email = '<you>';`

## 4. Staging validation

Run the scenarios V1–V17 in [`specs/001-chunk-learning-app/quickstart.md`](../../specs/001-chunk-learning-app/quickstart.md) against the Preview deployment, plus:

- Lighthouse on `/`, `/today`, `/progress` (mobile, LCP ≤ 2.5 s) → `web/docs/performance.md`
- One real recording each from iOS Safari and Android Chrome (T048) → `scoring/BENCHMARKS.md`

## 5. Going live with payments

Billing stays off until an admin types `ACTIVATE` in Admin → Settings. Do it only after the go-live checklist in the quickstart: Stripe test-mode run (subscribe, renew with a test clock, cancel, failed payment), Vercel Pro, **restricted** live key (`rk_live_…`, permissions: Customers, Checkout Sessions, Customer Portal, Subscriptions, Prices read) in Vercel env only, webhook endpoint `https://englishchunks.guru/api/webhooks/stripe` with its signing secret, and a decision on Stripe Tax (it stays off unless you have an active tax registration).
