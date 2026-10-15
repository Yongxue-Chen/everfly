import os
import sys
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

os.environ.setdefault("FLASK_SECRET_KEY", "test-secret")
os.environ.setdefault("MASTER_SECRET_KEY", "yQfOtmNHMhk_0T_Bq0ZyJPBC5nTrwT4GrIaeAt1CexM=")

from app import select_schedule_candidate  # noqa: E402
from china_localization import (  # noqa: E402
    chinese_airline_name,
    localized_china_airport,
)


class _Cursor:
    def __init__(self, row):
        self.row = row

    def fetchone(self):
        return self.row


class _TimezoneConn:
    def execute(self, query, args=()):
        code = args[0] if args else None
        if code in {"ZBAA", "PEK"}:
            return _Cursor((24, "Asia/Shanghai"))
        if code in {"LIMC", "MXP"}:
            return _Cursor((15, "Europe/Rome"))
        return _Cursor(None)


class ChinaLocalizationTest(unittest.TestCase):
    def test_known_china_airport_uses_bilingual_names(self):
        info = {"country": "CN", "iata": "PKX", "icao": "ZBAD", "city": "Beijing"}
        self.assertEqual(
            {
                "city": "Beijing (北京)",
                "airport": "Beijing Daxing International Airport (北京大兴)",
                "country": "China (中国)",
                "country_code": "CN",
            },
            localized_china_airport(info),
        )

    def test_unknown_china_airport_marks_missing_translation(self):
        info = {"country": "CN", "iata": "ZZZ", "icao": "ZXXX", "city": "English City"}
        localized = localized_china_airport(info)
        self.assertEqual("English City (中文名待补充)", localized["city"])
        self.assertEqual("Airport ZZZ (中文名待补充)", localized["airport"])

    def test_china_airline_code_uses_chinese_name(self):
        self.assertEqual("Air China (中国国航)", chinese_airline_name("CA"))
        self.assertEqual("Juneyao Airlines (吉祥航空)", chinese_airline_name("HO"))

    def test_bilingual_names_are_idempotent_and_aliases_remain_usable(self):
        from china_localization import localized_china_city, bilingual_alliance, localized_china_airline_alias
        from app import normalize_airline_payload, normalize_entity_names
        for name in ['北京', 'Beijing', 'Beijing (北京)', 'Beijing（北京）']:
            self.assertEqual(localized_china_city(name, 'CN'), 'Beijing (北京)')
        for name in ['Star Alliance', '星空联盟', 'Star Alliance (星空联盟)']:
            self.assertEqual(bilingual_alliance(name), 'Star Alliance (星空联盟)')
        self.assertEqual(localized_china_airline_alias('中国国航'), 'Air China (中国国航)')
        payload = normalize_airline_payload({'iata_code': 'ca', 'name': '中国国航', 'alliance': 'Star Alliance'})
        self.assertEqual(payload, normalize_airline_payload(payload))
        self.assertEqual(payload['name'], 'Air China (中国国航)')
        self.assertEqual(payload['alliance'], 'Star Alliance (星空联盟)')
        airport = normalize_entity_names('airports', {'iata_code': 'KMG', 'name': '昆明长水'})
        self.assertEqual(airport['name'], 'Kunming Changshui International Airport (昆明长水)')
        self.assertIsNone(localized_china_airport({'country': 'GB', 'iata': 'LHR'}))

    def test_schedule_selection_uses_origin_local_date(self):
        schedules = [
            {
                "ident": "CCA949-next-day",
                "scheduled_out": "2027-01-02T18:15:00Z",
                "origin_iata": "PEK",
                "origin_icao": "ZBAA",
                "destination_iata": "MXP",
                "destination_icao": "LIMC",
            },
            {
                "ident": "CCA949-requested-day",
                "scheduled_out": "2027-01-01T18:15:00Z",
                "origin_iata": "PEK",
                "origin_icao": "ZBAA",
                "destination_iata": "MXP",
                "destination_icao": "LIMC",
            },
        ]

        selected = select_schedule_candidate(
            schedules,
            "2027-01-02",
            _TimezoneConn(),
            1,
            origin_codes={"PEK", "ZBAA"},
            dest_codes={"MXP", "LIMC"},
        )

        self.assertEqual("CCA949-requested-day", selected["ident"])


if __name__ == "__main__":
    unittest.main()
