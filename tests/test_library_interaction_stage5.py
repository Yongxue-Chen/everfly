import os
import re
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


class LibraryInteractionStage5Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(os.path.join(ROOT, "templates", "index.html"), encoding="utf-8") as fh:
            cls.template = fh.read()
        with open(os.path.join(ROOT, "static", "js", "app.js"), encoding="utf-8") as fh:
            cls.js = fh.read()
        with open(os.path.join(ROOT, "static", "css", "style.css"), encoding="utf-8") as fh:
            cls.css = fh.read()

    def test_library_has_one_category_navigation_model(self):
        section = re.search(r'<section id="view-datasets".*?</section>', self.template, re.DOTALL).group(0)
        self.assertIn('id="library-overview"', section)
        self.assertNotIn('class="tabs"', section)
        self.assertNotIn('tab-btn', section)
        self.assertIn('data-dataset-key=', self.js)
        self.assertIn('aria-pressed=', self.js)

    def test_library_controls_and_states_are_explicit(self):
        for identifier in ["dataset-add-button", "dataset-search", "dataset-filter-reset", "dataset-results-status", "dataset-empty-state"]:
            self.assertIn(f'id="{identifier}"', self.template)
        self.assertIn("function resetLibraryFilters()", self.js)
        self.assertIn("function setLibraryLoading(loading)", self.js)
        self.assertIn("function renderLibraryError(message)", self.js)
        self.assertIn(".library-toolbar", self.css)
        self.assertIn(".dataset-empty-state", self.css)

    def test_library_operations_have_feedback(self):
        self.assertIn("function showToast(message", self.js)
        self.assertIn("function setButtonBusy(button", self.js)
        self.assertIn("function syncDatasetItem(datasetKey", self.js)
        self.assertIn("Delete ${itemName}? This cannot be undone.", self.js)
        self.assertIn(".toast-region", self.css)

    def test_generated_forms_have_labels_and_responsive_grid(self):
        self.assertIn("form.className = 'form-grid'", self.js)
        self.assertIn("label.htmlFor = fieldId", self.js)
        self.assertIn("input.id = fieldId", self.js)
        self.assertIn(".modal .form-grid", self.css)


if __name__ == "__main__":
    unittest.main()
