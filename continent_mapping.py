"""Country-to-continent classification based on UN M49 macro regions.

The mapping is keyed by ISO 3166-1 alpha-2 country/area code. IANA timezone
prefixes such as ``Atlantic`` and ``Indian`` are not continents.

Source: https://unstats.un.org/unsd/methodology/m49/overview/
Snapshot verified 2026-10-16. TW and XK are operational extensions because
they can occur in aviation data but are not rows in the M49 overview.
"""

_CODES_BY_CONTINENT = {
    "Africa": frozenset("""
        DZ EG LY MA SD TN EH IO BI KM DJ ER ET TF KE MG MW MU YT MZ RE RW SC SO
        SS UG TZ ZM ZW AO CM CF TD CG CD GQ GA ST BW SZ LS NA ZA BJ BF CV CI GM
        GH GN GW LR ML MR NE NG SH SN SL TG
    """.split()),
    "Americas": frozenset("""
        AI AG AW BS BB BQ VG KY CU CW DM DO GD GP HT JM MQ MS PR BL KN LC MF VC
        SX TT TC VI BZ CR SV GT HN MX NI PA AR BO BV BR CL CO EC FK GF GY PY PE
        GS SR UY VE BM CA GL PM US
    """.split()),
    "Antarctica": frozenset({"AQ"}),
    "Asia": frozenset("""
        KZ KG TJ TM UZ CN HK MO KP JP MN KR BN KH ID LA MY MM PH SG TH TL VN AF
        BD BT IN IR MV NP PK LK AM AZ BH CY GE IQ IL JO KW LB OM QA SA PS SY TR
        AE YE TW
    """.split()),
    "Europe": frozenset("""
        BY BG CZ HU PL MD RO RU SK UA AX DK EE FO FI GG IS IE IM JE LV LT NO SJ
        SE GB AL AD BA HR GI GR VA IT MT ME MK PT SM RS SI ES AT BE FR DE LI LU
        MC NL CH XK
    """.split()),
    "Oceania": frozenset("""
        AU CX CC HM NZ NF FJ NC PG SB VU GU KI MH FM NR MP PW UM AS CK PF NU PN
        WS TK TO TV WF
    """.split()),
}

COUNTRY_CONTINENT = {
    code: continent
    for continent, codes in _CODES_BY_CONTINENT.items()
    for code in codes
}


def continent_from_country_code(country_code):
    """Return the canonical continent label for an ISO alpha-2 code."""
    code = str(country_code or "").strip().upper()
    return COUNTRY_CONTINENT.get(code)

