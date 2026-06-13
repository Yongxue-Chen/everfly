import ast
import os
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SCRIPT = os.path.join(ROOT, "scripts", "sync_airline_logos.py")


class AirlineLogoSyncTest(unittest.TestCase):
    def test_sync_script_is_idempotent_and_handles_icao_only_airlines(self):
        with open(SCRIPT, encoding="utf-8") as fh:
            source = fh.read()
        tree = ast.parse(source)
        self.assertIsNotNone(tree)
        self.assertIn('"CHH": "HU"', source)
        self.assertIn('"DKH": "HO"', source)
        self.assertIn('if airline["logo_url"] and not force', source)
        self.assertIn('uploaded[code]', source)
        self.assertIn('IMAGEKIT_PRIVATE_KEY', source)
        self.assertIn('logo_source_url=%s', source)


if __name__ == "__main__":
    unittest.main()
