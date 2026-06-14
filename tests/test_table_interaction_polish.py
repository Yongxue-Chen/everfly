import os
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


class TableInteractionPolishTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(os.path.join(ROOT, "static", "js", "app.js"), encoding="utf-8") as fh:
            cls.js = fh.read()
        with open(os.path.join(ROOT, "static", "css", "style.css"), encoding="utf-8") as fh:
            cls.css = fh.read()

    def test_logo_failure_uses_neutral_icon_without_initials_under_image(self):
        self.assertIn("function airlineLogoPlaceholder", self.js)
        self.assertIn("image.parentElement.innerHTML = airlineLogoPlaceholder", self.js)
        primary_return = self.js.split("if (!primary)", 1)[1].split("function handleAirlineLogoError", 1)[0]
        self.assertNotIn("<span class=\"airline-logo-fallback\">${escapeHtml(initials)}</span></span>", primary_return)

    def test_airline_library_cell_contains_logo_identity(self):
        self.assertIn("library-airline-cell", self.js)
        self.assertIn("library-airline-codes", self.js)
        self.assertIn("airlineLogoMarkup(item.logo_url", self.js)

    def test_flight_targets_and_actions_are_explicit(self):
        self.assertIn("flight-row-hint", self.js)
        self.assertIn("const destination = ENTITY_LABELS[type]", self.js)
        self.assertIn('title="Open ${escapeHtml(destination)} details"', self.js)
        self.assertIn("flight-aircraft-tag", self.js)
        self.assertIn("action-danger", self.js)
        self.assertIn("deleteCurrentEntityPanel", self.js)

    def test_flight_airline_logo_opens_airline_panel(self):
        self.assertIn("airline-logo-link", self.js)
        self.assertIn("openEntityPanel('airlines'", self.js)

    def test_registration_has_explicit_external_link_box(self):
        self.assertIn("registration-link", self.js)
        self.assertIn("Open registration on Flightera", self.js)
        self.assertIn(".registration-link", self.css)

    def test_library_and_interaction_polish_styles_exist(self):
        for selector in [".library-airline-cell", ".entity-link", ".flight-row-hint", ".action-danger", ".flight-aircraft-tag"]:
            self.assertIn(selector, self.css)
        self.assertIn("data-action-label", self.js)


if __name__ == "__main__":
    unittest.main()
