import os
import re
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
APP_JS = os.path.join(ROOT, "static", "js", "app.js")


class FlightClassSelectTest(unittest.TestCase):
    def test_edit_flight_class_uses_select_options(self):
        with open(APP_JS, encoding="utf-8") as f:
            js = f.read()

        field_match = re.search(
            r"\{\s*key:\s*'flight_class',\s*label:\s*'Class',\s*type:\s*'select',\s*options:\s*\[(.*?)\]\s*\}",
            js,
            flags=re.DOTALL,
        )

        self.assertIsNotNone(field_match)
        options = field_match.group(1)
        for option in ("Economy", "Premium Economy", "Business", "First"):
            self.assertIn(f"'{option}'", options)


if __name__ == "__main__":
    unittest.main()
