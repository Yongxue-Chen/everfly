import os
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
STYLE_CSS = os.path.join(ROOT, "static", "css", "style.css")


class ProfileLocationsHoverTest(unittest.TestCase):
    def test_locations_rows_have_hover_emphasis(self):
        with open(STYLE_CSS, encoding="utf-8") as f:
            source = f.read()

        self.assertIn(".aviation-world-rank:hover", source)


if __name__ == "__main__":
    unittest.main()
