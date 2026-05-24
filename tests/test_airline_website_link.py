import os
import re
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
APP_PY = os.path.join(ROOT, "app.py")
APP_JS = os.path.join(ROOT, "static", "js", "app.js")


class AirlineWebsiteLinkTest(unittest.TestCase):
    def test_backend_accepts_airline_website_url_and_migrates_column(self):
        with open(APP_PY, encoding="utf-8") as fh:
            source = fh.read()

        airlines_cols_line = next(line for line in source.splitlines() if line.startswith("airlines_cols ="))
        self.assertIn("'website_url'", airlines_cols_line)
        self.assertIn("migrate_airlines_website_url", source)
        self.assertIn("ALTER TABLE airlines ADD COLUMN website_url", source)

    def test_airline_website_is_editable_but_not_a_table_column(self):
        with open(APP_JS, encoding="utf-8") as fh:
            source = fh.read()

        airlines_config = re.search(
            r"airlines: \{.*?\n    \},\n    aircraft_models:",
            source,
            flags=re.DOTALL,
        ).group(0)

        columns_block = re.search(r"columns: \[(.*?)\],\n        fields:", airlines_config, flags=re.DOTALL).group(1)
        fields_block = re.search(r"fields: \[(.*?)\]\n    \}", airlines_config, flags=re.DOTALL).group(1)

        self.assertNotIn("website_url", columns_block)
        self.assertIn("website_url", fields_block)

    def test_airline_name_rendering_uses_website_link(self):
        with open(APP_JS, encoding="utf-8") as fh:
            source = fh.read()

        self.assertIn("normalizeWebsiteUrl", source)
        self.assertIn("State.currentDataset === 'airlines' && col.key === 'name'", source)
        self.assertIn("item.website_url", source)
        self.assertIn("target = '_blank'", source)


if __name__ == "__main__":
    unittest.main()
