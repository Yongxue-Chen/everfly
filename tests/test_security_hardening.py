import os
import sys
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("FLASK_SECRET_KEY", "test-secret")
os.environ.setdefault("MASTER_SECRET_KEY", "yQfOtmNHMhk_0T_Bq0ZyJPBC5nTrwT4GrIaeAt1CexM=")

from app import app, safe_jsonify_error, validate_tenant_relationships  # noqa: E402


class FakeCursor:
    def __init__(self, row):
        self.row = row

    def fetchone(self):
        return self.row


class FakeConnection:
    def __init__(self, owned_ids):
        self.owned_ids = owned_ids
        self.queries = []

    def execute(self, query, args):
        self.queries.append((query, args))
        table = query.split("FROM ", 1)[1].split(" ", 1)[0]
        return FakeCursor((1,) if args[0] in self.owned_ids.get(table, set()) else None)


class SecurityHardeningTest(unittest.TestCase):
    def test_rejects_cross_user_flight_relationship(self):
        conn = FakeConnection({"airports": {10}, "airlines": {20}, "aircraft_models": {30}})

        with self.assertRaisesRegex(ValueError, "origin_airport_id"):
            validate_tenant_relationships(
                conn,
                "flights",
                {"origin_airport_id": 99, "dest_airport_id": 10},
                7,
            )

    def test_accepts_owned_relationships_and_nulls(self):
        conn = FakeConnection({"airports": {10}, "airlines": {20}, "aircraft_models": {30}})

        validate_tenant_relationships(
            conn,
            "flights",
            {
                "origin_airport_id": 10,
                "dest_airport_id": None,
                "airline_id": 20,
                "aircraft_model_id": 30,
            },
            7,
        )

        self.assertTrue(all("user_id = ?" in query for query, _ in conn.queries))

    def test_detailed_flight_joins_are_tenant_scoped(self):
        with open(os.path.join(ROOT, "app.py"), encoding="utf-8") as fh:
            source = fh.read()

        self.assertIn("LEFT JOIN airports oa ON f.origin_airport_id = oa.id AND oa.user_id = ?", source)
        self.assertIn("LEFT JOIN airports da ON f.dest_airport_id = da.id AND da.user_id = ?", source)
        self.assertIn("LEFT JOIN airlines al ON f.airline_id = al.id AND al.user_id = ?", source)
        self.assertIn("LEFT JOIN aircraft_models am ON f.aircraft_model_id = am.id AND am.user_id = ?", source)

    def test_csv_import_validates_tenant_relationships(self):
        with open(os.path.join(ROOT, "app.py"), encoding="utf-8") as fh:
            source = fh.read()

        import_section = source.split("def import_csv(table_name):", 1)[1].split("def clear_table(table_name):", 1)[0]
        self.assertIn("validate_tenant_relationships(conn, table_name, valid_data, g.user['id'])", import_section)

    def test_debug_error_response_is_not_recursive(self):
        with app.test_request_context("/api/test"):
            old_debug = app.debug
            app.debug = True
            try:
                response, status = safe_jsonify_error(ValueError("visible debug error"))
            finally:
                app.debug = old_debug

        self.assertEqual(500, status)
        self.assertEqual({"error": "visible debug error"}, response.get_json())

    def test_csrf_error_template_exists(self):
        self.assertTrue(os.path.exists(os.path.join(ROOT, "templates", "error.html")))


if __name__ == "__main__":
    unittest.main()
