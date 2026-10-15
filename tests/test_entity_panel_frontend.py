import os
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TEMPLATE = os.path.join(ROOT, "templates", "index.html")
APP_JS = os.path.join(ROOT, "static", "js", "app.js")
STYLE = os.path.join(ROOT, "static", "css", "style.css")


class EntityPanelFrontendTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(TEMPLATE, encoding="utf-8") as fh:
            cls.template = fh.read()
        with open(APP_JS, encoding="utf-8") as fh:
            cls.js = fh.read()
        with open(STYLE, encoding="utf-8") as fh:
            cls.css = fh.read()

    def test_template_contains_accessible_entity_panel_shell(self):
        self.assertIn('id="entity-panel-overlay"', self.template)
        self.assertIn('id="entity-panel"', self.template)
        self.assertIn('role="dialog"', self.template)
        self.assertIn('aria-modal="true"', self.template)
        self.assertIn('aria-labelledby="entity-panel-title"', self.template)
        self.assertIn('id="entity-panel-back"', self.template)
        self.assertIn('aria-label="Close details"', self.template)

    def test_panel_controller_and_history_exist(self):
        self.assertIn("entityPanelHistory: []", self.js)
        self.assertIn("async function openEntityPanel(type, id", self.js)
        self.assertIn("function closeEntityPanel()", self.js)
        self.assertIn("function goBackEntityPanel()", self.js)
        self.assertIn("function updateEntityPanelNavigation()", self.js)
        self.assertIn("function renderEntityPanel(payload)", self.js)
        self.assertIn("requestId !== State.entityPanelRequest", self.js)

    def test_panel_manages_focus_loading_and_operation_feedback(self):
        self.assertIn("State.entityPanelTrigger", self.js)
        self.assertIn("panel.setAttribute('aria-busy', 'true')", self.js)
        self.assertIn("if (event.key === 'Escape')", self.js)
        self.assertIn("deleteCurrentEntityPanel(this)", self.js)
        self.assertIn("showToast(`${ENTITY_LABELS[current.type] || 'Record'} deleted.`)", self.js)
        self.assertIn("body.entity-panel-open { overflow: hidden; }", self.css)

    def test_flight_and_dataset_renderers_link_entities(self):
        self.assertIn("entityLinkButton('airlines'", self.js)
        self.assertIn("entityLinkButton('airports'", self.js)
        self.assertIn("entityLinkButton('aircraft_models'", self.js)
        self.assertIn("openEntityPanel(State.currentDataset", self.js)

    def test_mobile_panel_is_full_width(self):
        self.assertIn(".entity-panel", self.css)
        self.assertIn("width: 100%", self.css.split("@media (max-width: 768px)", 1)[1])

    def test_cloud_premium_navigation_and_tokens_exist(self):
        self.assertIn('>Journey<', self.template)
        self.assertIn('>Library<', self.template)
        for token in ["--surface", "--surface-border", "--radius-lg", "--shadow-soft", "--text-muted"]:
            self.assertIn(token, self.css)
        self.assertIn("function editEntityFromPanel", self.js)
        self.assertIn("function entityRelationshipLinks", self.js)
        self.assertIn("relationshipLinks", self.js)


if __name__ == "__main__":
    unittest.main()
