import os
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
APP_PY = os.path.join(ROOT, "app.py")
SCHEMA = os.path.join(ROOT, "schema_mysql.sql")
MIGRATION = os.path.join(ROOT, "migrations", "20260612_airline_logo_metadata.sql")


class AirlineLogoManagementTest(unittest.TestCase):
    def test_clean_schema_contains_airline_logo_metadata(self):
        with open(SCHEMA, encoding="utf-8") as fh:
            source = fh.read()

        self.assertIn("logo_url", source)
        self.assertIn("logo_source_url", source)
        self.assertIn("logo_file_id", source)

    def test_existing_database_migration_adds_logo_metadata(self):
        self.assertTrue(os.path.exists(MIGRATION))
        with open(MIGRATION, encoding="utf-8") as fh:
            source = fh.read()

        self.assertIn("logo_source_url", source)
        self.assertIn("logo_file_id", source)
        self.assertIn("INFORMATION_SCHEMA.COLUMNS", source)

    def test_airline_crud_accepts_logo_metadata(self):
        with open(APP_PY, encoding="utf-8") as fh:
            source = fh.read()

        airlines_cols_block = source.split("airlines_cols =", 1)[1].split("\naircraft_cols =", 1)[0]
        self.assertIn("'logo_url'", airlines_cols_block)
        self.assertIn("'logo_source_url'", airlines_cols_block)
        self.assertIn("'logo_file_id'", airlines_cols_block)

    def test_logo_routes_and_secure_url_validation_exist(self):
        with open(APP_PY, encoding="utf-8") as fh:
            source = fh.read()

        self.assertIn("def validate_public_image_url", source)
        self.assertIn("ipaddress.ip_address", source)
        self.assertIn("address.is_global", source)
        self.assertIn("/api/airlines/<int:id>/logo", source)
        self.assertIn("IMAGEKIT_PRIVATE_KEY", source)
        self.assertIn("IMAGEKIT_URL_ENDPOINT", source)
        self.assertNotIn("IMAGEKIT_PRIVATE_KEY = '", source)
        self.assertIn("request.files.get('file')", source)
        self.assertIn("1024 * 1024", source)
        self.assertIn("image/svg+xml", source)

    def test_frontend_logo_fallback_contract_exists(self):
        app_js = os.path.join(ROOT, "static", "js", "app.js")
        with open(app_js, encoding="utf-8") as fh:
            source = fh.read()

        self.assertIn("function airlineLogoMarkup", source)
        self.assertIn("loading=\"lazy\"", source)
        self.assertIn("logo_source_url", source)
        self.assertIn("airline-logo-placeholder", source)
        self.assertIn("API.upload(`airlines/${id}/logo`", source)


if __name__ == "__main__":
    unittest.main()
