import os
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


class GlobalInteractionStage7Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(os.path.join(ROOT, "templates", "index.html"), encoding="utf-8") as fh:
            cls.template = fh.read()
        with open(os.path.join(ROOT, "static", "js", "app.js"), encoding="utf-8") as fh:
            cls.js = fh.read()
        with open(os.path.join(ROOT, "static", "css", "style.css"), encoding="utf-8") as fh:
            cls.css = fh.read()

    def test_site_uses_in_app_feedback_instead_of_blocking_alerts(self):
        self.assertNotIn("alert(", self.js)
        self.assertNotIn("prompt(", self.js)
        self.assertIn("app-toast-warning", self.css)
        self.assertIn("app-toast-info", self.css)

    def test_profile_and_logo_forms_have_explicit_labels(self):
        for field_id in [
            "airline-logo-url", "airline-logo-file", "profile-username",
            "profile-password", "profile-confirm-password", "profile-api-key",
        ]:
            self.assertIn(f'for="{field_id}"', self.js)
            self.assertIn(f'id="{field_id}"', self.js)
        self.assertIn('autocomplete="username"', self.js)
        self.assertIn('autocomplete="new-password"', self.js)

    def test_map_layer_buttons_expose_selection(self):
        self.assertIn('data-map-layer="map" aria-pressed="true"', self.template)
        self.assertIn('data-map-layer="satellite" aria-pressed="false"', self.template)
        self.assertIn("button.setAttribute('aria-pressed', String(selected))", self.js)

    def test_nested_option_add_uses_accessible_modal(self):
        self.assertIn("openModal(`Add ${optionLabel}`", self.js)
        self.assertIn("btn.setAttribute('aria-label', `Add ${optionLabel.toLowerCase()}`)", self.js)
        self.assertIn("form-control-inline", self.css)


if __name__ == "__main__":
    unittest.main()
