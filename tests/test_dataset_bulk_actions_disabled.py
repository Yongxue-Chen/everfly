import os
import re
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
INDEX_TEMPLATE = os.path.join(ROOT, "templates", "index.html")
APP_JS = os.path.join(ROOT, "static", "js", "app.js")


class DatasetBulkActionsDisabledTest(unittest.TestCase):
    def test_unavailable_bulk_actions_do_not_clutter_library(self):
        with open(INDEX_TEMPLATE, encoding="utf-8") as fh:
            source = fh.read()

        datasets_section = re.search(
            r'<section id="view-datasets".*?</section>',
            source,
            flags=re.DOTALL,
        ).group(0)

        self.assertNotIn("Import CSV", datasets_section)
        self.assertNotIn("Auto-Fill", datasets_section)
        self.assertNotIn("openImportModal()", datasets_section)
        self.assertNotIn("clearCurrentDataset()", datasets_section)

    def test_disabled_auto_fill_buttons_are_not_created(self):
        with open(APP_JS, encoding="utf-8") as fh:
            source = fh.read()

        self.assertNotIn("addDisabledAutoFillButton", source)
        self.assertNotIn("dataset-dynamic-actions", source)


if __name__ == "__main__":
    unittest.main()
