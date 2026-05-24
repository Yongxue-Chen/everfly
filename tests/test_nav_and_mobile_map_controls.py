import os
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
INDEX_TEMPLATE = os.path.join(ROOT, "templates", "index.html")
APP_JS = os.path.join(ROOT, "static", "js", "app.js")
STYLE_CSS = os.path.join(ROOT, "static", "css", "style.css")


class NavAndMobileMapControlsTest(unittest.TestCase):
    def test_top_nav_has_single_dataset_entry(self):
        with open(INDEX_TEMPLATE, encoding="utf-8") as fh:
            source = fh.read()

        self.assertIn('data-view-nav="datasets"', source)
        self.assertIn("onclick=\"navigateTo('datasets')\"", source)
        self.assertIn(">Data<", source)
        self.assertNotIn("data-dataset-nav=", source)
        self.assertNotIn("navigateToDataset('cities')", source)

    def test_dataset_navigation_helper_sets_dataset_tab(self):
        with open(APP_JS, encoding="utf-8") as fh:
            source = fh.read()
        with open(INDEX_TEMPLATE, encoding="utf-8") as fh:
            template = fh.read()

        self.assertIn("data-view-nav=\"datasets\"", template)
        self.assertIn('document.querySelector(`.nav-item[data-view-nav="${viewName}"]`)', source)
        self.assertIn("function invalidateProfileMapSize()", source)
        self.assertIn("State.map.invalidateSize({ pan: false })", source)
        self.assertIn("minZoom: 1", source)
        self.assertIn("ResizeObserver", source)

    def test_mobile_map_controls_are_anchored_to_right(self):
        with open(STYLE_CSS, encoding="utf-8") as fh:
            source = fh.read()

        self.assertIn(".map-controls", source)
        self.assertIn("left: auto;", source)
        self.assertIn("right: 8px;", source)
        self.assertIn("max-width: calc(100% - 72px);", source)
        self.assertIn("grid-template-columns: minmax(88px, 1fr) auto auto;", source)
        self.assertIn(".leaflet-control-zoom", source)
        self.assertIn(".leaflet-control-zoom a", source)
        self.assertIn("height: clamp(280px, 38svh, 380px);", source)


if __name__ == "__main__":
    unittest.main()
