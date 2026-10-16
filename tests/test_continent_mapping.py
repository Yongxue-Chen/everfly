import os
import sys
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from continent_mapping import COUNTRY_CONTINENT, continent_from_country_code
from scripts.backfill_city_continents import backfill_city_continents


class _Cursor:
    def __init__(self, rows):
        self._rows = rows

    def fetchall(self):
        return self._rows


class _Connection:
    def __init__(self, rows):
        self.rows = rows
        self.updates = []
        self.commits = 0

    def execute(self, query, args=()):
        if query.lstrip().startswith("SELECT"):
            return _Cursor(self.rows)
        self.updates.append((query, args))
        return _Cursor([])

    def commit(self):
        self.commits += 1


class ContinentMappingTest(unittest.TestCase):
    def test_uses_country_codes_instead_of_timezone_regions(self):
        self.assertEqual("Europe", continent_from_country_code("IS"))
        self.assertEqual("Africa", continent_from_country_code("CV"))
        self.assertEqual("Americas", continent_from_country_code("BM"))
        self.assertEqual("Oceania", continent_from_country_code("NZ"))

    def test_normalizes_input_and_handles_unknown_codes(self):
        self.assertEqual("Asia", continent_from_country_code(" cn "))
        self.assertIsNone(continent_from_country_code(""))
        self.assertIsNone(continent_from_country_code("ZZ"))

    def test_m49_snapshot_and_extensions_have_unique_country_codes(self):
        self.assertEqual(250, len(COUNTRY_CONTINENT))

    def test_backfill_repairs_timezone_prefix_values(self):
        conn = _Connection([
            (50, "Reykjavik", "IS", "Atlantic"),
            (51, "New York", "US", "America"),
            (52, "Beijing", "CN", "Asia"),
            (53, "Unknown", "ZZ", None),
        ])

        changes, skipped = backfill_city_continents(conn, apply=True)

        self.assertEqual([
            (50, "Reykjavik", "Atlantic", "Europe"),
            (51, "New York", "America", "Americas"),
        ], changes)
        self.assertEqual([(53, "Unknown", "ZZ")], skipped)
        self.assertEqual(2, len(conn.updates))
        self.assertEqual(1, conn.commits)


if __name__ == "__main__":
    unittest.main()
