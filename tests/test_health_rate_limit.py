import os
import sys
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("FLASK_SECRET_KEY", "test-secret")
os.environ.setdefault("MASTER_SECRET_KEY", "yQfOtmNHMhk_0T_Bq0ZyJPBC5nTrwT4GrIaeAt1CexM=")

from app import app, limiter  # noqa: E402


class HealthRateLimitTest(unittest.TestCase):
    def setUp(self):
        limiter.reset()
        self.client = app.test_client()

    def test_health_endpoint_is_not_rate_limited(self):
        response = None

        for _ in range(201):
            response = self.client.get("/api/health")

        self.assertEqual(200, response.status_code)
        self.assertEqual({"status": "ok"}, response.get_json())


if __name__ == "__main__":
    unittest.main()
