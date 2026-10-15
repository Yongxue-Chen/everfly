import os
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


class FlightsInteractionStage4Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(os.path.join(ROOT, "templates", "index.html"), encoding="utf-8") as fh:
            cls.template = fh.read()
        with open(os.path.join(ROOT, "static", "js", "app.js"), encoding="utf-8") as fh:
            cls.js = fh.read()
        with open(os.path.join(ROOT, "static", "css", "style.css"), encoding="utf-8") as fh:
            cls.css = fh.read()

    def test_flight_controls_are_available_on_all_viewports(self):
        self.assertIn('id="flight-search"', self.template)
        self.assertIn('id="flight-sort-select"', self.template)
        self.assertIn('id="flight-results-status"', self.template)
        self.assertIn('id="flights-empty-state"', self.template)
        self.assertIn("function resetFlightFilters()", self.js)
        self.assertIn("function setFlightListLoading(loading)", self.js)
        self.assertIn(".flight-list-toolbar", self.css)

    def test_modal_contract_includes_accessibility_and_safety(self):
        self.assertIn("modal.setAttribute('role', 'dialog')", self.js)
        self.assertIn("modal.setAttribute('aria-modal', 'true')", self.js)
        self.assertIn("Discard unsaved changes?", self.js)
        self.assertIn("record.trigger.focus()", self.js)
        self.assertIn("event.key !== 'Tab'", self.js)
        self.assertIn("cancelBtn.textContent = 'Cancel'", self.js)
        self.assertIn("fa-spinner fa-spin", self.js)

    def test_quick_add_requires_minimum_healthy_fields(self):
        quick_add = self.js.split("async function openAddFlightModal()", 1)[1]
        self.assertIn("key: 'flight_number'", quick_add)
        self.assertIn("key: 'date'", quick_add)
        self.assertGreaterEqual(quick_add[:700].count("required: true"), 2)


if __name__ == "__main__":
    unittest.main()
