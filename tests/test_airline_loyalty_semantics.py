import os
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


class AirlineLoyaltySemanticsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(os.path.join(ROOT, "app.py"), encoding="utf-8") as fh:
            cls.app_source = fh.read()
        with open(os.path.join(ROOT, "static", "js", "app.js"), encoding="utf-8") as fh:
            cls.js_source = fh.read()

    def test_airline_payload_normalizes_semantic_fields(self):
        self.assertIn("def normalize_airline_payload(data):", self.app_source)
        self.assertIn("re.sub(r'[\\s-]+'", self.app_source)
        self.assertIn("AIRLINE_ALLIANCE_ALIASES", self.app_source)
        self.assertIn("if table_name == 'airlines':", self.app_source)

    def test_alliance_statistics_use_alliance_column(self):
        breakdown = self.app_source.split("stats['breakdowns']['alliance']", 1)[1].split(
            "stats['breakdowns']['manufacturer']", 1
        )[0]
        self.assertIn("SELECT al.alliance", breakdown)
        self.assertNotIn("SELECT al.frequent_flyer_program", breakdown)

        top = self.app_source.split("stats['top']['airlines']", 1)[1].split(
            "stats['top']['aircraft']", 1
        )[0]
        self.assertIn("SELECT al.name, COUNT(*) as cnt, al.alliance", top)

    def test_airline_ui_separates_alliance_program_and_member_number(self):
        airlines_config = self.js_source.split("airlines: {", 1)[1].split(
            "aircraft_models: {", 1
        )[0]
        self.assertIn("label: 'Alliance'", airlines_config)
        self.assertIn("label: 'Loyalty Program'", airlines_config)
        self.assertIn("label: 'Member No.'", airlines_config)
        self.assertIn("Object.entries(ALLIANCE_LABELS)", airlines_config)
        self.assertIn("Do not add airline codes such as EK or TK", airlines_config)

        self.assertIn("airline-alliance-badge", self.js_source)
        self.assertIn("airline-member-number", self.js_source)
        self.assertIn("filter-airline-program", self.js_source)
        self.assertIn("SkyTeam (天合联盟)", self.js_source)
        self.assertIn("Star Alliance (星空联盟)", self.js_source)
        self.assertIn("Oneworld (寰宇一家)", self.js_source)
        self.assertGreaterEqual(self.js_source.count("formatAllianceLabel("), 4)

    def test_dataset_sort_handles_empty_alliance_values(self):
        self.assertIn("function compareDatasetValues(valA, valB, direction = 'asc')", self.js_source)
        self.assertIn("if (emptyA) return 1;", self.js_source)
        self.assertIn("if (emptyB) return -1;", self.js_source)
        self.assertIn("sensitivity: 'base'", self.js_source)
        self.assertEqual(
            self.js_source.count("return compareDatasetValues(valA, valB, State.sort.dir);"),
            2,
        )


if __name__ == "__main__":
    unittest.main()
