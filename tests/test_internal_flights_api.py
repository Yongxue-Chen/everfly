import os
import sys
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("FLASK_SECRET_KEY", "test-secret")
os.environ.setdefault("MASTER_SECRET_KEY", "yQfOtmNHMhk_0T_Bq0ZyJPBC5nTrwT4GrIaeAt1CexM=")

import database  # noqa: E402
import app as app_module  # noqa: E402
from app import app, limiter  # noqa: E402


class FakeUsersConnection:
    def __init__(self, user_row):
        self.user_row = user_row
        self.closed = False

    def execute(self, query, args=()):
        return FakeCursor(self.user_row)

    def close(self):
        self.closed = True


class FakeCursor:
    def __init__(self, row=None, lastrowid=0):
        self.row = row
        self.lastrowid = lastrowid

    def fetchone(self):
        return self.row


class FakeConnection:
    def __init__(self):
        self.queries = []
        self.committed = False
        self.rolled_back = False

    def execute(self, query, args=()):
        self.queries.append((query, args))
        if "FROM users" in query:
            return FakeCursor((7,))
        if query.startswith("INSERT INTO flights"):
            return FakeCursor(lastrowid=42)
        if "FROM flights f" in query:
            return FakeCursor((42, 7, "2099-07-05", None, None, None))
        return FakeCursor()

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True


class InternalFlightsApiTest(unittest.TestCase):
    def setUp(self):
        limiter.reset()
        self.client = app.test_client()
        self.old_token = os.environ.get("INTERNAL_SERVICE_TOKEN")
        self.old_username = os.environ.get("EVERFLY_INTERNAL_USERNAME")
        os.environ["INTERNAL_SERVICE_TOKEN"] = "shared-secret"
        os.environ["EVERFLY_INTERNAL_USERNAME"] = "testuser"
        self.old_get_db = database.get_db
        self.fake_conn = FakeConnection()
        database.get_db = lambda: self.fake_conn

        self.old_get_users_db = database.get_users_db
        self.fake_users_conn = FakeUsersConnection({"id": 7, "username": "testuser", "api_key_encrypted": None})
        database.get_users_db = lambda: self.fake_users_conn

        self.old_auto_update = app_module.update_single_flight_from_aeroapi
        self.auto_update_calls = []
        app_module.update_single_flight_from_aeroapi = lambda flight_id, force=False: self.auto_update_calls.append((flight_id, force)) or {'message': 'stub'}

    def tearDown(self):
        database.get_db = self.old_get_db
        database.get_users_db = self.old_get_users_db
        app_module.update_single_flight_from_aeroapi = self.old_auto_update
        if self.old_token is None:
            os.environ.pop("INTERNAL_SERVICE_TOKEN", None)
        else:
            os.environ["INTERNAL_SERVICE_TOKEN"] = self.old_token
        if self.old_username is None:
            os.environ.pop("EVERFLY_INTERNAL_USERNAME", None)
        else:
            os.environ["EVERFLY_INTERNAL_USERNAME"] = self.old_username

    def test_rejects_missing_bearer_token(self):
        response = self.client.post("/api/internal/flights", json={
            "flightNumber": "cx 251",
            "date": "2099-07-05",
        })

        self.assertEqual(401, response.status_code)
        self.assertEqual({"error": "unauthorized", "ok": False}, response.get_json())
        self.assertEqual([], self.fake_conn.queries)

    def test_creates_minimal_flight_for_configured_user(self):
        response = self.client.post(
            "/api/internal/flights",
            json={"flightNumber": "cx 251", "date": "2099-07-05"},
            headers={"Authorization": "Bearer shared-secret"},
        )

        self.assertEqual(201, response.status_code)
        self.assertEqual({
            "ok": True,
            "flight": {
                "id": 42,
                "user_id": 7,
                "date": "2099-07-05",
                "flight_number": "CX251",
            },
        }, response.get_json())
        self.assertEqual(
            ("SELECT id FROM users WHERE username = ? LIMIT 1", ("testuser",)),
            self.fake_conn.queries[0],
        )
        self.assertEqual(
            ("INSERT INTO flights (user_id, date, flight_number) VALUES (?, ?, ?)", (7, "2099-07-05", "CX251")),
            self.fake_conn.queries[1],
        )
        self.assertTrue(any("INSERT INTO flight_aeroapi_jobs" in query for query, _ in self.fake_conn.queries))
        self.assertTrue(self.fake_conn.committed)
        self.assertEqual([(42, False)], self.auto_update_calls)
        self.assertTrue(self.fake_users_conn.closed)

    def test_normalizes_icao_airline_prefix_to_iata_for_internal_import(self):
        response = self.client.post(
            "/api/internal/flights",
            json={"flightNumber": "ezy 2106", "date": "2099-07-05"},
            headers={"Authorization": "Bearer shared-secret"},
        )

        self.assertEqual(201, response.status_code)
        self.assertEqual("U22106", response.get_json()["flight"]["flight_number"])
        self.assertEqual(
            ("INSERT INTO flights (user_id, date, flight_number) VALUES (?, ?, ?)", (7, "2099-07-05", "U22106")),
            self.fake_conn.queries[1],
        )

    def test_rejects_missing_required_fields(self):
        response = self.client.post(
            "/api/internal/flights",
            json={"flightNumber": "CX251"},
            headers={"Authorization": "Bearer shared-secret"},
        )

        self.assertEqual(400, response.status_code)
        self.assertEqual({"error": "date is required", "ok": False}, response.get_json())
        self.assertEqual([], self.fake_conn.queries)


if __name__ == "__main__":
    unittest.main()
