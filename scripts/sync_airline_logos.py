"""Import airline logos into ImageKit and update MySQL references.

Run inside the application container after IMAGEKIT_* and MYSQL_* variables are set.
The operation is idempotent by default; pass --force to replace existing logos.
"""
import argparse
import os
import sys
import uuid

import pymysql
import requests

SOURCE_TEMPLATE = "https://images.kiwi.com/airlines/64/{code}.png"
ICAO_TO_IATA = {"CHH": "HU", "DKH": "HO"}


def effective_logo_code(airline):
    return (airline.get("iata_code") or ICAO_TO_IATA.get(airline.get("icao_code")) or "").strip().upper()


def upload_logo(private_key, airline_code, source_url):
    response = requests.post(
        "https://upload.imagekit.io/api/v1/files/upload",
        auth=(private_key, ""),
        data={
            "file": source_url,
            "fileName": f"airline-{airline_code.lower()}-{uuid.uuid4().hex}.png",
            "folder": "/everfly/airlines/",
            "useUniqueFileName": "true",
        },
        timeout=25,
    )
    response.raise_for_status()
    payload = response.json()
    return payload["url"], payload["fileId"]


def connect_db():
    return pymysql.connect(
        host=os.environ["MYSQL_HOST"],
        port=int(os.environ.get("MYSQL_PORT", "3306")),
        user=os.environ["MYSQL_USER"],
        password=os.environ["MYSQL_PASSWORD"],
        database=os.environ["MYSQL_DB"],
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=False,
    )


def sync(force=False):
    private_key = os.environ.get("IMAGEKIT_PRIVATE_KEY", "").strip()
    endpoint = os.environ.get("IMAGEKIT_URL_ENDPOINT", "").strip()
    if not private_key or not endpoint:
        raise RuntimeError("IMAGEKIT_PRIVATE_KEY and IMAGEKIT_URL_ENDPOINT must be configured")

    conn = connect_db()
    uploaded = {}
    updated = skipped = failed = 0
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, name, iata_code, icao_code, logo_url FROM airlines ORDER BY id")
            airlines = cur.fetchall()
            for airline in airlines:
                if airline["logo_url"] and not force:
                    skipped += 1
                    continue
                code = effective_logo_code(airline)
                if not code:
                    print(f"SKIP {airline['name']}: no IATA/logo alias", file=sys.stderr)
                    failed += 1
                    continue
                source_url = SOURCE_TEMPLATE.format(code=code)
                try:
                    if code not in uploaded:
                        uploaded[code] = upload_logo(private_key, code, source_url)
                    logo_url, file_id = uploaded[code]
                    cur.execute(
                        "UPDATE airlines SET logo_url=%s, logo_source_url=%s, logo_file_id=%s WHERE id=%s",
                        (logo_url, source_url, file_id, airline["id"]),
                    )
                    updated += 1
                    print(f"OK {airline['name']} ({code})")
                except Exception as exc:
                    failed += 1
                    print(f"FAIL {airline['name']} ({code}): {exc}", file=sys.stderr)
            conn.commit()
    finally:
        conn.close()
    print(f"Logo sync complete: updated={updated} skipped={skipped} failed={failed} unique_uploads={len(uploaded)}")
    return 1 if failed else 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--force", action="store_true", help="replace existing logo references")
    args = parser.parse_args()
    raise SystemExit(sync(force=args.force))
