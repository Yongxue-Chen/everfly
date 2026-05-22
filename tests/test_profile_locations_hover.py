import os
import re
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
APP_JS = os.path.join(ROOT, "static", "js", "app.js")


class ProfileLocationsHoverTest(unittest.TestCase):
    def test_locations_rows_have_hover_emphasis(self):
        with open(APP_JS, encoding="utf-8") as f:
            source = f.read()

        match = re.search(
            r"const addLocItem = \(label, count, key, title\) => \{(?P<body>.*?)\n    \};",
            source,
            re.S,
        )

        self.assertIsNotNone(match)
        body = match.group("body")
        self.assertIn("row.onmouseenter", body)
        self.assertIn("row.onmouseleave", body)
        self.assertIn("#f0f0f0", body)
        self.assertIn("transparent", body)


if __name__ == "__main__":
    unittest.main()
