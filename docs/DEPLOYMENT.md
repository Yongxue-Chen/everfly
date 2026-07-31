# Deployment guide

*[中文文档](DEPLOYMENT.zh-CN.md)*

everfly is a single Flask container plus a MySQL server you provide. This guide
covers running it in a way you can upgrade and roll back with confidence.

If you just want it running, `docker-compose.example.yml` in the repository root
is standalone and needs nothing set up beforehand:

```bash
cp .env.example .env    # fill in the required values
docker compose -f docker-compose.example.yml up -d --build
```

The rest of this document is about operating it over time.

## The central idea: two checkouts

> **The directory you develop in and the directory production builds from should
> not be the same directory.**

A tag-based deployment has to check out that tag. If production builds from the
same directory you develop in, deploying `v1.1.0` leaves that directory in
detached `HEAD` — and the next time you sit down to write code you are silently
committing onto a detached head instead of `main`.

Separating them removes the conflict entirely:

| Directory | Role | Git state |
| --- | --- | --- |
| your clone, e.g. `~/everfly` | development | always on `main` |
| a second checkout, e.g. `/opt/everfly` | production build source | detached at a release tag |

You never `cd` into the production checkout by hand. `deploy.sh` owns it.

### Setting it up

```bash
sudo mkdir -p /opt/everfly
sudo chown "$USER":"$USER" /opt/everfly
git clone https://github.com/Yongxue-Chen/everfly.git /opt/everfly
git -C /opt/everfly checkout --detach v1.0.0
```

Then write a compose file whose build context points at that checkout. Keep the
compose file and its `.env` **outside** the checkout, so your secrets do not live
in a directory that deployments overwrite:

```yaml
# /srv/everfly-deploy/docker-compose.yml
services:
  everfly-app:
    build:
      context: /opt/everfly    # the production checkout, not your dev tree
      dockerfile: Dockerfile
    image: everfly:local
    container_name: everfly-app
    restart: always
    ports:
      - "5000:5000"
    env_file:
      - .env                   # sits next to this file, mode 600
    healthcheck:
      test: ["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/api/health', timeout=5)\""]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s
```

If everfly needs to reach — or be reached by — other containers, add the shared
network here. That is deployment-specific, which is why the example compose file
in the repository root deliberately declares none.

## Configuring deploy.sh

`deploy.sh` has working defaults for every setting, so it may need no
configuration at all. To pin down paths for your host, copy the example and edit
it. `deploy.env` is not tracked by Git:

```bash
cp deploy.env.example deploy.env
```

```bash
# deploy.env
EVERFLY_SRC_DIR=/opt/everfly
EVERFLY_COMPOSE_FILE=/srv/everfly-deploy/docker-compose.yml
EVERFLY_COMPOSE_PROJECT=everfly
```

| Variable | Default |
| --- | --- |
| `EVERFLY_SRC_DIR` | `/opt/everfly` |
| `EVERFLY_COMPOSE_FILE` | `$EVERFLY_SRC_DIR/docker-compose.yml` |
| `EVERFLY_COMPOSE_PROJECT` | `everfly` |
| `EVERFLY_CONTAINER` | `everfly-app` |
| `EVERFLY_HEALTH_URL` | `http://127.0.0.1:5000/api/health` |
| `EVERFLY_HEALTH_TIMEOUT` | `120` |

`deploy.env` is looked for at `$EVERFLY_DEPLOY_ENV`, then next to `deploy.sh`,
then `/etc/everfly/deploy.env`. An environment variable set on the command line
always wins, so one-off overrides still work:

```bash
EVERFLY_HEALTH_TIMEOUT=300 ./deploy.sh v1.1.0
```

Running a second environment is then just a second file:

```bash
EVERFLY_DEPLOY_ENV=/etc/everfly/staging.env ./deploy.sh v1.1.0
```

## Day-to-day development

```bash
cd ~/everfly
git checkout main          # you should never need this — but it is the fix if you drift
git pull
# edit, test, commit
python -m unittest discover -s tests
git push origin main
```

Nothing you do here touches production. No build context points at this
directory, so an uncommitted experiment cannot leak into a deployed image.

## Releasing

Production tracks **tags**, not `main`. New commits on `main` never affect the
running service; you decide when to upgrade.

```bash
cd ~/everfly
python -m unittest discover -s tests            # green before tagging
git tag -a v1.1.0 -m "What changed in this release"
git push origin v1.1.0

./deploy.sh v1.1.0
```

`deploy.sh` can be run from anywhere — it operates on the production checkout
regardless of where the script itself lives.

### What deploy.sh does

1. Refuses to run if the production checkout has uncommitted changes.
2. `git fetch --tags --force --prune` from origin.
3. Checks out the requested tag (detached) in the production checkout.
4. `docker compose build` and `docker compose up -d`.
5. Polls container health, up to `EVERFLY_HEALTH_TIMEOUT` seconds.
6. On failure: prints the last 40 log lines and tells you the rollback command.
7. On success: records the previous ref in `.deploy-last-ref`.

### Rollback

```bash
./deploy.sh --rollback     # back to the previously deployed ref
./deploy.sh v1.0.0         # or to a specific tag
```

Rollback is only trustworthy because `requirements.txt` is pinned — an old tag
rebuilds with the dependency set it was tested against.

## Manual deployment

If you are not using `deploy.sh`:

```bash
git -C /opt/everfly fetch --tags --force origin
git -C /opt/everfly checkout --detach v1.1.0
cd /srv/everfly-deploy
docker compose up -d --build
```

If `requirements.txt` changed and you want to be certain the layer cache is not
reused:

```bash
docker compose build --no-cache
docker compose up -d
```

If only `.env` changed, no rebuild is needed:

```bash
docker compose up -d --force-recreate
```

## Database migrations

Back up first. Always.

```bash
mysqldump -h <host> -u <user> -p <database> > backup-$(date +%F).sql
```

A **new** database loads the schema directly:

```bash
mysql -h <host> -u everfly -p everfly < schema_mysql.sql
```

An **existing** database must not have the full schema re-imported. Write an
explicit `ALTER TABLE` migration under `migrations/` and run it by hand.

`migrations/20260609_tenant_integrity_constraints.sql` adds tenant foreign-key
constraints. It checks for orphaned rows and cross-tenant references first and
**aborts** rather than adding constraints over inconsistent data. If it aborts,
clean up the rows it reports and re-run.

## Operations

```bash
# health
curl -i http://127.0.0.1:5000/api/health

# container status
docker ps --filter name=everfly-app

# logs
docker logs --tail 100 -f everfly-app

# which version is live
git -C /opt/everfly describe --tags
```

### Airline logo sync

After configuring ImageKit and rebuilding:

```bash
docker exec everfly-app python scripts/sync_airline_logos.py
```

Idempotent; skips airlines that already have a `logo_url`. Use `--force` only
when deliberately replacing every logo reference.

### Scheduled AeroAPI jobs

everfly exposes an internal endpoint that processes queued AeroAPI lookups. Call
it on a schedule — a systemd timer, a cron entry, or any external scheduler —
authenticating with `INTERNAL_SERVICE_TOKEN`:

```bash
curl -fsS -X POST \
  -H "Authorization: Bearer $INTERNAL_SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"limit":10}' \
  http://127.0.0.1:5000/api/internal/aeroapi_jobs/run
```

Every 10 minutes is a reasonable starting cadence.

## Reverse proxy

Terminate TLS in front of the app and proxy to `http://127.0.0.1:5000`. Once
every request arrives over HTTPS, enable secure cookies in `app.py`:

```python
app.config['SESSION_COOKIE_SECURE'] = True
```
