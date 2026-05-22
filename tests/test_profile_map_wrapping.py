import os
import re
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
APP_JS = os.path.join(ROOT, "static", "js", "app.js")


class ProfileMapWrappingTest(unittest.TestCase):
    def test_profile_map_uses_dynamic_longitude_offsets(self):
        with open(APP_JS, encoding="utf-8") as f:
            source = f.read()

        self.assertIn("function getVisibleWorldLongitudeOffsets", source)
        self.assertIn("State.profileMapFlights", source)
        self.assertIn("refreshProfileMapLayers", source)
        self.assertRegex(source, re.compile(r"moveend zoomend"))


if __name__ == "__main__":
    unittest.main()
