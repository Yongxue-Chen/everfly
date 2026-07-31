# Deployment guide

*[中文文档](DEPLOYMENT.zh-CN.md)*

This document describes how everfly is developed and deployed. The central idea:

> **The development tree and the production build source are two different directories.**

## Why the split

A tag-based deployment has to check out that tag. If production builds from the
same directory you develop in, deploying `v1.1.0` leaves that directory in
detached `HEAD` — and the next time you sit down to write code you are silently
committing onto a detached head instead of `main`.

Separating them removes the conflict entirely:

| Directory | Role | Git state |
| --- | --- | --- |
| your clone, e.g. `~/everfly` | development | always on `main` |
| `/opt/everfly` | production build source | detached at a release tag |

You never `cd` into `/opt/everfly` by hand. `deploy.sh` owns it.

## Reference topology

This is the layout used by the reference deployment. Adjust paths to taste; every
one of them is overridable via environment variables.

| Thing | Location |
| --- | --- |
| Development checkout | `/home/ubuntu/everfly` (on `main`) |
| Production checkout | `/opt/everfly` (detached at a tag) |
| Compose file | `/opt/1panel/docker/compose/flightlog/docker-compose.yml` |
| Production `.env` | `/opt/1panel/docker/compose/flightlog/.env` (mode `600`, root-owned) |
| Compose project | `flightlog` |
| Container | `everfly-app` |
| Port | host `5000` → container `5000` |
| Health check | `http://127.0.0.1:5000/api/health` |

> The compose project and its directory are still named `flightlog`. That is the
> directory 1Panel created before the project was renamed; renaming it would
> recreate the container for no benefit. It is a label only — the service, image
> and container are all named `everfly`.

The production `.env` lives **next to the compose file, outside the Git tree**, so
secrets are never in a checkout that gets rewritten by deployments.

### Setting up the production checkout

One-time, on a fresh host:

```bash
sudo mkdir -p /opt/everfly
sudo chown "$USER":"$USER" /opt/everfly
git clone https://github.com/Yongxue-Chen/everfly.git /opt/everfly
git -C /opt/everfly checkout --detach v1.0.0
```

Point the compose file's build context at it:

```yaml
services:
  everfly-app:
    build:
      context: /opt/everfly    # <- production checkout, not your dev tree
      dockerfile: Dockerfile
    image: everfly:local
    container_name: everfly-app
    restart: always
    ports:
      - "5000:5000"
    healthcheck:
      test: ["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('http://127.0.0.1:5000/api/health', timeout=5)\""]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 20s
    env_file:
      - .env
    networks:
      1panel-network:
      travel-services:

networks:
  1panel-network:
    external: true
  travel-services:
    external: true
```

## Day-to-day development

```bash
cd ~/everfly
git checkout main          # you should never need this — but it is the fix if you drift
git pull
# edit, test, commit
python -m pytest tests/ -q
git push origin main
```

Nothing you do here touches production. There is no build context pointing at
this directory, so an uncommitted experiment can never leak into a deployed
image.

## Releasing

Production tracks **tags**, not `main`. New commits on `main` never affect the
running service; you decide when to upgrade.

```bash
cd ~/everfly
python -m pytest tests/ -q            # green before tagging
git tag -a v1.1.0 -m "What changed in this release"
git push origin v1.1.0

./deploy.sh v1.1.0
```

`deploy.sh` can be run from anywhere — it operates on `/opt/everfly` regardless
of where the script itself lives.

### What deploy.sh does

1. Refuses to run if the production checkout has uncommitted changes.
2. `git fetch --tags --force --prune` from origin.
3. Checks out the requested tag (detached) in `/opt/everfly`.
4. `docker compose build` and `docker compose up -d`.
5. Polls the container health status, up to `EVERFLY_HEALTH_TIMEOUT` seconds.
6. On failure: prints the last 40 log lines and tells you the rollback command.
7. On success: records the previous ref in `/opt/everfly/.deploy-last-ref`.

### Rollback

```bash
./deploy.sh --rollback     # back to the previously deployed ref
./deploy.sh v1.0.0         # or to a specific tag
```

### Configuration

Every path is an environment variable with a production-shaped default:

| Variable | Default |
| --- | --- |
| `EVERFLY_SRC_DIR` | `/opt/everfly` |
| `EVERFLY_COMPOSE_FILE` | `/opt/1panel/docker/compose/flightlog/docker-compose.yml` |
| `EVERFLY_COMPOSE_PROJECT` | `flightlog` |
| `EVERFLY_CONTAINER` | `everfly-app` |
| `EVERFLY_HEALTH_URL` | `http://127.0.0.1:5000/api/health` |
| `EVERFLY_HEALTH_TIMEOUT` | `120` |

So a second environment is just a matter of overriding them:

```bash
EVERFLY_SRC_DIR=/opt/everfly-staging \
EVERFLY_COMPOSE_FILE=/opt/compose/everfly-staging/docker-compose.yml \
EVERFLY_COMPOSE_PROJECT=everfly-staging \
EVERFLY_CONTAINER=everfly-staging-app \
EVERFLY_HEALTH_URL=http://127.0.0.1:5001/api/health \
./deploy.sh v1.1.0
```

## Manual deployment

If you are not using `deploy.sh`:

```bash
git -C /opt/everfly fetch --tags --force origin
git -C /opt/everfly checkout --detach v1.1.0
cd /opt/1panel/docker/compose/flightlog
docker compose -p flightlog up -d --build
```

If `requirements.txt` changed and you want to be certain the layer cache is not
reused:

```bash
docker compose -p flightlog build --no-cache
docker compose -p flightlog up -d
```

If only `.env` changed, no rebuild is needed:

```bash
docker compose -p flightlog up -d --force-recreate
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

# which ref is deployed
git -C /opt/everfly describe --tags

# compose logs
cd /opt/1panel/docker/compose/flightlog && docker compose logs -f --tail=100
```

### Airline logo sync

After configuring ImageKit and rebuilding:

```bash
docker exec everfly-app python scripts/sync_airline_logos.py
```

The sync is idempotent and skips airlines that already have a `logo_url`. Use
`--force` only when deliberately replacing every logo reference.

### Scheduled AeroAPI jobs

The reference deployment runs AeroAPI jobs from a systemd timer every 10 minutes,
authenticating with `INTERNAL_SERVICE_TOKEN` read out of the running container:

```ini
# /etc/systemd/system/everfly-aeroapi-jobs.service
[Unit]
Description=Run everfly AeroAPI scheduled jobs
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/bin/bash -lc 'TOKEN="$$(/usr/bin/docker exec everfly-app printenv INTERNAL_SERVICE_TOKEN)" && /usr/bin/curl -fsS -X POST -H "Authorization: Bearer $${TOKEN}" -H "Content-Type: application/json" -d "{\"limit\":10}" http://127.0.0.1:5000/api/internal/aeroapi_jobs/run'
```

## Reverse proxy

Terminate TLS in front of the app and proxy to `http://127.0.0.1:5000`. With
1Panel this is a website entry plus its Let's Encrypt integration. Once every
request arrives over HTTPS, enable secure cookies in `app.py`:

```python
app.config['SESSION_COOKIE_SECURE'] = True
```
