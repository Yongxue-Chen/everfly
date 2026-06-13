import os
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
APP_PY = os.path.join(ROOT, "app.py")


class EntityDetailsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(APP_PY, encoding="utf-8") as fh:
            cls.source = fh.read()

    def test_all_entity_detail_routes_exist(self):
        for entity in ["flights", "airlines", "airports", "cities", "aircraft_models"]:
            self.assertIn(f"/api/entities/{entity}/<int:id>", self.source)

    def test_entity_detail_queries_are_tenant_scoped(self):
        section = self.source.split("# --- Entity Detail APIs ---", 1)[1].split("# --- End Entity Detail APIs ---", 1)[0]
        self.assertGreaterEqual(section.count("user_id = ?"), 10)
        self.assertIn("g.user['id']", section)
        self.assertIn("'Not found'", section)

    def test_detailed_flights_include_airline_identity_and_logos(self):
        section = self.source.split("def get_detailed_flights():", 1)[1].split("def update_single_flight_from_aeroapi", 1)[0]
        self.assertIn("al.iata_code as airline_iata_code", section)
        self.assertIn("al.icao_code as airline_icao_code", section)
        self.assertIn("al.logo_url as airline_logo_url", section)
        self.assertIn("al.logo_source_url as airline_logo_source_url", section)


if __name__ == "__main__":
    unittest.main()
