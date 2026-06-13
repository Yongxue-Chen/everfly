import os
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
APP_JS = os.path.join(ROOT, "static", "js", "app.js")


class FrontendXssHardeningTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(APP_JS, encoding="utf-8") as fh:
            cls.source = fh.read()

    def test_shared_html_escape_helper_exists(self):
        self.assertIn("function escapeHtml(value)", self.source)
        self.assertIn("replace(/&/g, '&amp;')", self.source)
        self.assertIn("replace(/</g, '&lt;')", self.source)
        self.assertIn("replace(/>/g, '&gt;')", self.source)

    def test_flight_dynamic_values_are_escaped(self):
        self.assertIn("const safe = (value) => escapeHtml(value || '-')", self.source)
        self.assertIn("${escapeHtml(f.note || '')}", self.source)
        self.assertNotIn("onclick=\"openEditFlightModal(${JSON.stringify(f)", self.source)

    def test_profile_and_map_dynamic_values_are_escaped(self):
        self.assertIn("${escapeHtml(CURRENT_USER.username)}", self.source)
        self.assertIn("line.bindPopup(`${escapeHtml(f.flight_number)", self.source)
        self.assertIn("m.bindPopup(`<b>${escapeHtml(code)}</b>", self.source)

    def test_stats_modal_dynamic_values_are_escaped(self):
        self.assertIn("title=\"${escapeHtml(item.name)}\"", self.source)
        self.assertIn("${escapeHtml(item.name || 'Unknown')}", self.source)
        self.assertIn("${escapeHtml(item.extra)}", self.source)


if __name__ == "__main__":
    unittest.main()
