import os
import re
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
INDEX_TEMPLATE = os.path.join(ROOT, "templates", "index.html")
APP_JS = os.path.join(ROOT, "static", "js", "app.js")


class DatasetBulkActionsDisabledTest(unittest.TestCase):
    def test_dataset_import_and_clear_buttons_are_disabled(self):
        with open(INDEX_TEMPLATE, encoding="utf-8") as fh:
            source = fh.read()

        datasets_section = re.search(
            r'<section id="view-datasets".*?</section>',
            source,
            flags=re.DOTALL,
        ).group(0)

        self.assertIn("Import CSV", datasets_section)
        self.assertIn("Clear", datasets_section)
        self.assertNotIn("openImportModal()", datasets_section)
        self.assertNotIn("clearCurrentDataset()", datasets_section)

        import_button = re.search(r'<button[^>]*>\s*<i[^>]*></i> Import CSV\s*</button>', datasets_section, re.DOTALL).group(0)
        clear_button = re.search(r'<button[^>]*>\s*<i[^>]*></i> Clear\s*</button>', datasets_section, re.DOTALL).group(0)

        self.assertIn("disabled", import_button)
        self.assertIn("cursor: not-allowed", import_button)
        self.assertIn("disabled", clear_button)
        self.assertIn("cursor: not-allowed", clear_button)

    def test_dataset_auto_fill_buttons_are_disabled(self):
        with open(APP_JS, encoding="utf-8") as fh:
            source = fh.read()

        dynamic_toolbar = re.search(
            r'// --- Dynamic Toolbar Buttons ---.*?renderDatasetTable\(config, data\);',
            source,
            flags=re.DOTALL,
        ).group(0)

        self.assertIn("Auto-Fill", dynamic_toolbar)
        self.assertIn("btn.disabled = true", dynamic_toolbar)
        self.assertIn("cursor = 'not-allowed'", dynamic_toolbar)
        self.assertNotIn("batch_update", dynamic_toolbar)


if __name__ == "__main__":
    unittest.main()
