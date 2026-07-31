# everfly

[![CI](https://github.com/Yongxue-Chen/everfly/actions/workflows/ci.yml/badge.svg)](https://github.com/Yongxue-Chen/everfly/actions/workflows/ci.yml)

*[中文文档](README.zh-CN.md)*

everfly is a self-hosted Flask web application for recording, managing and visualising your personal flight history.

It turns a list of flights into something worth looking at: a map of every route you have flown, milestone counters, yearly rhythm charts, and browsable cards for the airlines, aircraft, airports and cities behind the numbers.

## Features

- **Flight log** — flight number, date, airline, aircraft type, origin/destination airports and terminals, scheduled and actual times, seat, cabin class and notes.
- **Reference data** — full CRUD for cities, airports, airlines and aircraft models.
- **Autocompletion** — airport ICAO codes, coordinates, city and timezone filled in automatically from [`airportsdata`](https://pypi.org/project/airportsdata/).
- **Timezone-aware durations** — scheduled and actual flight time computed from the origin and destination timezones, not from naive clock arithmetic.
- **Statistics and visualisation** — totals by airline, aircraft, route, city, country and continent; a route map and yearly charts.
- **CSV bulk import** — for cities, airports, airlines, aircraft models and flights.
- **FlightAware AeroAPI integration** — each user stores their own API key, encrypted at rest with the server's `MASTER_SECRET_KEY`.
- **Multi-tenant** — all business data lives in a shared MySQL database, partitioned by `user_id`. Registration is gated by an invitation code.

## Tech stack

| Layer | Choice |
| --- | --- |
| Backend | Python, Flask, Gunicorn |
| Database | MySQL (PyMySQL) |
| Frontend | Jinja templates, vanilla JavaScript, Leaflet, Chart.js |
| Container | Docker, Docker Compose |
| Optional ops | 1Panel |

Key files:

| Path | Purpose |
| --- | --- |
| `app.py` | Flask application: routes, APIs, auth, import, statistics, AeroAPI |
| `database.py` | MySQL connection wrapper |
| `schema_mysql.sql` | Source of truth for the database schema |
| `migrations/` | Explicit, hand-run SQL migrations |
| `templates/`, `static/` | HTML templates and frontend assets |
| `Dockerfile` | Production image, served by Gunicorn |
| `deploy.sh` | Tag-based deployment helper |

## Quick start

Requires Python 3.9+ and a reachable MySQL 8 server. The production image is
built on `python:3.9-slim`.

```bash
git clone https://github.com/Yongxue-Chen/everfly.git
cd everfly
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # then fill it in — see below
```

Create the database and load the schema:

```sql
CREATE DATABASE everfly CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'everfly'@'%' IDENTIFIED BY 'change-this-password';
GRANT ALL PRIVILEGES ON everfly.* TO 'everfly'@'%';
FLUSH PRIVILEGES;
```

```bash
mysql -h <mysql-host> -u everfly -p everfly < schema_mysql.sql
```

The application does **not** create business tables at startup. `schema_mysql.sql` is the only source of schema truth.

Then run it:

```bash
python app.py
```

and open <http://127.0.0.1:5000>.

For anything other than local development, use Gunicorn rather than the Flask dev server:

```bash
gunicorn -w 4 -b 127.0.0.1:5000 app:app
```

## Configuration

All configuration is via environment variables. Copy `.env.example` to `.env` and fill it in. Never commit a real `.env`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `MASTER_SECRET_KEY` | yes | Fernet key encrypting users' stored FlightAware API keys |
| `FLASK_SECRET_KEY` | yes | Flask session signing key |
| `INVITATION_CODE` | yes | Code required to register a new account |
| `FLASK_DEBUG` | no | `false` in production |
| `MYSQL_HOST` / `MYSQL_PORT` / `MYSQL_USER` / `MYSQL_PASSWORD` / `MYSQL_DB` | yes | Database connection |
| `IMAGEKIT_PRIVATE_KEY` / `IMAGEKIT_URL_ENDPOINT` | no | Airline logo storage and CDN delivery |
| `INTERNAL_SERVICE_TOKEN` | no | Bearer token for the internal service API |
| `EVERFLY_INTERNAL_USERNAME` | no | Existing username that internal-API flight drafts are attributed to |

Generate the two secrets:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
python -c "import secrets; print(secrets.token_hex(32))"
```

> **`MASTER_SECRET_KEY` must stay stable across deployments.** It encrypts users' FlightAware API keys. If you rotate or lose it, existing ciphertexts become undecryptable and every user must re-enter their key.

Airline logos work without ImageKit — the app falls back to the source URL and then to an airline-code placeholder if ImageKit is unconfigured, fails, or is out of quota. `IMAGEKIT_PRIVATE_KEY` is server-side only and never reaches the browser.

## Deployment

`docker-compose.example.yml` is a portable starting point:

```bash
docker compose -f docker-compose.example.yml up -d --build
```

For the full production setup — the split between the development tree and the
production checkout, tag-based releases, rollback, 1Panel, schema migrations and
day-to-day ops commands — see **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**.

The short version: development happens in your own clone on `main`; production
builds from a **separate checkout pinned to a tag**, driven by `deploy.sh`.

```bash
./deploy.sh v1.1.0     # deploy a tag
./deploy.sh --rollback # go back to the previously deployed ref
```

## Development

```bash
source venv/bin/activate
python -m unittest discover -s tests
```

98 tests live in `tests/`, covering the API surface, tenant isolation, AeroAPI
scheduling and frontend hardening. They use only the standard library's
`unittest` — no extra test dependency to install — and do not need a running
MySQL server. Run them before tagging a release.

Working on the code:

```bash
git checkout main
git pull
# ...edit, commit...
git push origin main
```

Your development tree should stay on `main`. Deployments never build from it —
see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for why and how.

## Security notes

- Keep `FLASK_DEBUG=false` in production.
- Serve over HTTPS via a reverse proxy. If access is always HTTPS, set
  `app.config['SESSION_COOKIE_SECURE'] = True` in `app.py`.
- Never commit `MASTER_SECRET_KEY`, `FLASK_SECRET_KEY`, database passwords or
  the invitation code.
- Back up the MySQL database before any upgrade or migration.

## License

[PolyForm Noncommercial License 1.0.0](LICENSE).

You may use, modify and share everfly for **any noncommercial purpose**,
including personal and self-hosted use. Commercial use is not granted by this
license. Note that PolyForm Noncommercial is a *source-available* licence, not an
OSI-approved open-source one.
