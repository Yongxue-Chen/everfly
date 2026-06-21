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

    def test_monthly_stats_sql_escapes_percent_literals_for_pymysql(self):
        stats_section = self.app_source.split("def get_stats():", 1)[1].split("return jsonify(stats)", 1)[0]
        self.assertIn("'%%Y-%%m-%%d'", stats_section)
        self.assertIn("'%%Y-%%m'", stats_section)
        self.assertNotIn("'%Y-%m-%d'", stats_section)
        self.assertNotIn("'%Y-%m'", stats_section)

    def test_journey_view_has_insight_and_chart_regions(self):
        self.assertIn('id="journey-highlights"', self.template)
        self.assertIn('id="journey-trends"', self.template)
        self.assertIn("renderJourneyHighlights", self.js)
        self.assertIn("renderJourneyTrends", self.js)
        self.assertIn("monthlyChart", self.js)
        self.assertIn("distanceBucketChart", self.js)

    def test_journey_charts_are_labeled_and_deduplicated(self):
        self.assertIn("text: 'Flights / Hours'", self.js)
        self.assertIn("text: 'Distance (km)'", self.js)
        self.assertIn("renderMonthOfYearStats", self.js)
        self.assertIn("month-of-year-grid", self.js)
        self.assertIn("Month pattern", self.js)
        dashboard_section = self.js.split("const renderStatsDashboard", 1)[1].split("const showStatsModal", 1)[0]
        self.assertNotIn("Flights per Year", dashboard_section)
        self.assertNotIn("yearChart", dashboard_section)

    def test_aviation_world_uses_fancy_cards_and_aligned_highlights(self):
        self.assertIn("aviation-world-card", self.js)
        self.assertIn("aviation-world-rank", self.js)
        self.assertIn(".aviation-world-card", self.css)
        self.assertIn(".aviation-world-rank", self.css)
        self.assertIn("align-self: center", self.css)
        self.assertIn("box-sizing: border-box", self.css)

    def test_dashboard_items_and_charts_open_flight_lists(self):
        self.assertIn("function openFlightListModal", self.js)
        self.assertIn("filterFlightsForInsight", self.js)
        self.assertIn("onClick", self.js)
        self.assertIn("openFlightListModal('Recent months'", self.js)
        self.assertIn("openFlightListModal('Yearly rhythm'", self.js)
        self.assertIn("openFlightListModal('Route distance mix'", self.js)
        self.assertIn("openFlightListModal('Month pattern'", self.js)
        self.assertIn("showStatsModal", self.js)
        self.assertIn("handleLocationClick", self.js)

    def test_trend_ranges_fill_missing_months_and_years(self):
        self.assertIn("buildRecentTwelveMonths", self.js)
        self.assertIn("buildContinuousYears", self.js)
        self.assertIn("Array.from({ length: 12 }", self.js)
        self.assertNotIn("months.slice(-18)", self.js)

    def test_airline_stats_have_five_categories_and_detailed_airline_fields(self):
        stats_section = self.app_source.split("def get_stats():", 1)[1].split("return jsonify(stats)", 1)[0]
        detailed_section = self.app_source.split("def get_detailed_flights():", 1)[1].split("return jsonify(flights)", 1)[0]
        self.assertIn("airline_categories", stats_section)
        for label in ["SkyTeam", "Star Alliance", "Oneworld", "Low-cost", "Other"]:
            self.assertIn(label, stats_section)
        self.assertIn("'%%SkyTeam%%'", stats_section)
        self.assertNotIn("'%SkyTeam%'", stats_section)
        self.assertNotIn("low.?cost", stats_section)
        self.assertIn("al.alliance as airline_alliance", detailed_section)
        self.assertIn("al.country as airline_country", detailed_section)

    def test_library_view_has_overview_and_quality_contract(self):
        self.assertIn('id="library-overview"', self.template)
        self.assertIn("renderLibraryOverview", self.js)
        self.assertIn("library-health-pill", self.js)
        self.assertIn(".library-overview", self.css)
        self.assertIn(".library-health-pill", self.css)


if __name__ == "__main__":
    unittest.main()
