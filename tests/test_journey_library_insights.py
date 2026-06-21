import os
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


class JourneyLibraryInsightsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(os.path.join(ROOT, "app.py"), encoding="utf-8") as fh:
            cls.app_source = fh.read()
        with open(os.path.join(ROOT, "templates", "index.html"), encoding="utf-8") as fh:
            cls.template = fh.read()
        with open(os.path.join(ROOT, "static", "js", "app.js"), encoding="utf-8") as fh:
            cls.js = fh.read()
        with open(os.path.join(ROOT, "static", "css", "style.css"), encoding="utf-8") as fh:
            cls.css = fh.read()

    def test_stats_api_exposes_journey_insights(self):
        stats_section = self.app_source.split("def get_stats():", 1)[1].split("return jsonify(stats)", 1)[0]
        for key in [
            "'records'",
            "'distributions'",
            "'quality'",
            "'flights_by_month'",
            "'distance_by_year'",
            "'duration_by_year'",
            "'cumulative_airports_by_year'",
        ]:
            self.assertIn(key, stats_section)
        self.assertIn("longest_distance", stats_section)
        self.assertIn("route_distance_buckets", stats_section)
        self.assertIn("missing_registration", stats_section)

    def test_journey_view_has_insight_and_chart_regions(self):
        self.assertIn('id="journey-highlights"', self.template)
        self.assertIn('id="journey-trends"', self.template)
        self.assertIn("renderJourneyHighlights", self.js)
        self.assertIn("renderJourneyTrends", self.js)
        self.assertIn("monthlyChart", self.js)
        self.assertIn("distanceBucketChart", self.js)

    def test_library_view_has_overview_and_quality_contract(self):
        self.assertIn('id="library-overview"', self.template)
        self.assertIn("renderLibraryOverview", self.js)
        self.assertIn("library-health-pill", self.js)
        self.assertIn(".library-overview", self.css)
        self.assertIn(".library-health-pill", self.css)


if __name__ == "__main__":
    unittest.main()
