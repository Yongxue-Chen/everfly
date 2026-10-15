import os
import re
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
INDEX_TEMPLATE = os.path.join(ROOT, "templates", "index.html")


class FlightImportDisabledTest(unittest.TestCase):
    def test_flight_history_hides_unavailable_import_action(self):
        with open(INDEX_TEMPLATE, encoding="utf-8") as fh:
            source = fh.read()

        flights_section = re.search(
            r'<section id="view-flights".*?</section>',
            source,
            flags=re.DOTALL,
        ).group(0)

        self.assertNotIn("Import CSV", flights_section)
        self.assertNotIn("Update Missing", flights_section)
        self.assertNotIn("openImportFlightsModal()", flights_section)

    def test_dataset_import_csv_entry_is_hidden_until_available(self):
        with open(INDEX_TEMPLATE, encoding="utf-8") as fh:
            source = fh.read()

        datasets_section = re.search(
            r'<section id="view-datasets".*?</section>',
            source,
            flags=re.DOTALL,
        ).group(0)

        self.assertNotIn("Import CSV", datasets_section)
        self.assertNotIn("openImportModal()", datasets_section)


if __name__ == "__main__":
    unittest.main()
