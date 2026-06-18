import os
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

class CompleteCloudPremiumUiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(os.path.join(ROOT, "templates", "index.html"), encoding="utf-8") as fh:
            cls.template = fh.read()
        with open(os.path.join(ROOT, "static", "js", "app.js"), encoding="utf-8") as fh:
            cls.js = fh.read()
        with open(os.path.join(ROOT, "static", "css", "style.css"), encoding="utf-8") as fh:
            cls.css = fh.read()

    def test_journey_has_complete_cloud_premium_structure(self):
        self.assertIn('class="journey-shell"', self.template)
        self.assertIn('id="journey-hero"', self.template)
        self.assertIn('id="journey-metrics"', self.template)
        self.assertIn('class="journey-map-panel"', self.template)
        self.assertIn('function renderJourneyHero', self.js)

    def test_aircraft_model_and_registration_are_separate_blocks(self):
        self.assertIn('class="flight-aircraft-model"', self.js)
        self.assertIn('class="flight-aircraft-registration"', self.js)
        self.assertIn('.flight-aircraft-model', self.css)
        self.assertIn('.flight-aircraft-registration', self.css)
        self.assertIn('display: block', self.css.split('.flight-aircraft-registration', 1)[1][:220])

    def test_mobile_flights_have_premium_card_contract(self):
        self.assertIn('flight-route-strip', self.js)
        self.assertIn('.flight-route-strip', self.css)
        self.assertIn('.flight-row', self.css)
        self.assertIn('border-radius: 18px', self.css)

    def test_static_assets_use_cloud_premium_version(self):
        self.assertIn('/static/css/style.css?v=cloud-premium-7', self.template)
        self.assertIn('/static/js/app.js?v=cloud-premium-7', self.template)

if __name__ == "__main__":
    unittest.main()
