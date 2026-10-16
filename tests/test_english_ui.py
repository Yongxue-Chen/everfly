import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


class EnglishUiTest(unittest.TestCase):
    def test_templates_have_english_interface_copy(self):
        for template in (ROOT / 'templates').glob('*.html'):
            self.assertIsNone(re.search(r'[\u3400-\u9fff]', template.read_text()), template.name)

    def test_chinese_in_javascript_is_only_data_or_input_aliases(self):
        for source in (ROOT / 'static/js').glob('*.js'):
            for number, line in enumerate(source.read_text().splitlines(), 1):
                if not re.search(r'[\u3400-\u9fff]', line):
                    continue
                allowed = any(token in line for token in ['SkyTeam', 'Star Alliance', 'Oneworld', '/^航站楼', 'lowcost|廉航/', "'靠窗': 'Window'"])
                self.assertTrue(allowed, f'{source.name}:{number}: untranslated interface copy')

    def test_filters_are_inside_shared_journey_toolbar(self):
        template = (ROOT / 'templates/index.html').read_text()
        toolbar = template.split('class="journey-toolbar"', 1)[1].split('id="journey-hero"', 1)[0]
        self.assertIn('id="year-filter"', toolbar)
        self.assertIn('id="journey-status-filter"', toolbar)
