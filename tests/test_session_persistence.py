import email.utils
import os
import re
import sys
import unittest
from datetime import datetime, timezone


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("FLASK_SECRET_KEY", "test-secret")
os.environ.setdefault("MASTER_SECRET_KEY", "yQfOtmNHMhk_0T_Bq0ZyJPBC5nTrwT4GrIaeAt1CexM=")

import database  # noqa: E402
import werkzeug.security  # noqa: E402
from app import app, limiter  # noqa: E402


class FakeCursor:
    def __init__(self, row=None):
        self.row = row

    def fetchone(self):
        return self.row


class FakeUsersConnection:
    """Just enough of database.get_users_db() for the auth flow."""

    def __init__(self, user):
        self.user = user
        self.queries = []

    def execute(self, query, args=()):
        self.queries.append((query, tuple(args)))
        if query.startswith("UPDATE users SET password_hash = ?, auth_epoch = ?"):
            self.user["password_hash"] = args[0]
            self.user["auth_epoch"] = args[1]
        return FakeCursor(self.user)

    def commit(self):
        pass

    def close(self):
        pass


class SessionPersistenceTest(unittest.TestCase):
    """Long-lived ("stay logged in") sessions and their revocation."""

    def setUp(self):
        limiter.reset()
        app.config["TESTING"] = True
        self.user = {
            "id": 7,
            "username": "alice",
            "password_hash": werkzeug.security.generate_password_hash("correct-horse"),
            "api_key_encrypted": None,
            "auth_epoch": 0,
        }
        self.old_get_users_db = database.get_users_db
        database.get_users_db = lambda: FakeUsersConnection(self.user)

    def tearDown(self):
        database.get_users_db = self.old_get_users_db

    def _client(self):
        return app.test_client()

    def _get(self, client, path):
        # https scheme so the Secure session cookie is stored and sent back.
        return client.get(path, base_url="https://localhost")

    def _post(self, client, path, **kwargs):
        # Browsers send Referer on form/XHR posts; flask-wtf rejects HTTPS
        # requests without one, so tests must mimic that.
        headers = kwargs.pop("headers", {})
        headers.setdefault("Referer", "https://localhost/")
        return client.post(path, base_url="https://localhost", headers=headers, **kwargs)

    def _csrf_token(self, client):
        page = self._get(client, "/login")
        match = re.search(rb'name="csrf_token" value="([^"]+)"', page.data)
        self.assertIsNotNone(match, "login page should carry a CSRF token")
        return match.group(1).decode()

    def _login(self, client, password="correct-horse"):
        token = self._csrf_token(client)
        return self._post(client, "/login", data={
            "username": "alice",
            "password": password,
            "csrf_token": token,
        })

    def test_login_cookie_is_persistent_and_secure(self):
        client = self._client()
        response = self._login(client)

        self.assertEqual(302, response.status_code)
        set_cookie = response.headers.get("Set-Cookie", "")
        self.assertIn("Secure", set_cookie)
        self.assertIn("HttpOnly", set_cookie)

        # Persistent cookie valid for ~30 days (PERMANENT_SESSION_LIFETIME),
        # whichever way the werkzeug version in use spells the expiry.
        if "Max-Age=2592000" in set_cookie:
            return
        match = re.search(r"Expires=([^;]+)", set_cookie)
        self.assertIsNotNone(match, "login cookie should carry an expiry")
        expires = email.utils.parsedate_to_datetime(match.group(1))
        lifetime = (expires - datetime.now(timezone.utc)).total_seconds()
        self.assertGreater(lifetime, 29 * 24 * 3600)
        self.assertLessEqual(lifetime, 30 * 24 * 3600 + 60)

    def test_session_carries_user_and_auth_epoch(self):
        client = self._client()
        self._login(client)

        with client.session_transaction() as sess:
            self.assertTrue(sess.get("_permanent"), "session should survive browser restarts")
            self.assertEqual(7, sess.get("user_id"))
            self.assertEqual(0, sess.get("auth_epoch"))

    def test_old_style_session_is_upgraded_to_persistent(self):
        client = self._client()
        # A session cookie issued before long-lived sessions existed: no
        # _permanent flag, no auth_epoch key at all.
        with client.session_transaction() as sess:
            sess["user_id"] = 7

        self.assertEqual(200, self._get(client, "/api/profile/api-key").status_code)

        with client.session_transaction() as sess:
            self.assertTrue(sess.get("_permanent"), "old session should be upgraded in place")

    def test_password_change_keeps_current_device_but_kicks_others(self):
        current = self._client()
        self._login(current)
        other = self._client()
        self._login(other)

        response = self._post(
            current,
            "/api/profile/update",
            json={"username": "alice", "password": "new-correct-horse"},
            headers={"X-CSRFToken": self._csrf_token(current)},
        )
        self.assertEqual(200, response.status_code)
        self.assertEqual(1, self.user["auth_epoch"])

        # The device that changed the password stays logged in.
        self.assertEqual(200, self._get(current, "/api/profile/api-key").status_code)

        # The other device holds a cookie issued at auth_epoch 0 → rejected.
        kicked = self._get(other, "/api/profile/api-key")
        self.assertEqual(302, kicked.status_code)
        self.assertIn("/login", kicked.headers.get("Location", ""))

        # Logging in afresh works and picks up the new epoch.
        self.assertEqual(302, self._login(other, password="new-correct-horse").status_code)
        with other.session_transaction() as sess:
            self.assertEqual(1, sess.get("auth_epoch"))


if __name__ == "__main__":
    unittest.main()
