"""English-first bilingual names for China-region entities.

Airport and airline code mappings are derived from the MIT-licensed
Timeon1/TMC_Dataset. Unknown China-region airports still receive a stable
explicit missing-translation marker rather than an invented Chinese name.
"""

from functools import lru_cache

CHINESE_REGION_CODES = frozenset({'CN', 'HK', 'MO', 'TW'})

CHINESE_COUNTRY_NAMES = {
    'CN': 'China (中国)',
    'HK': 'Hong Kong (中国香港)',
    'MO': 'Macao (中国澳门)',
    'TW': 'Taiwan (中国台湾)',
}

# IATA -> (city, airport). Names follow the application's compact convention
# and omit the trailing “国际机场/机场”.
CHINA_AIRPORTS_BY_IATA = {
    'AAT': ('阿勒泰', '阿勒泰雪都'),
    'AKU': ('阿克苏', '阿克苏红旗坡'),
    'BAV': ('包头', '包头东河'),
    'BHY': ('北海', '北海福成'),
    'CAN': ('广州', '广州白云'),
    'CGD': ('常德', '常德桃花源'),
    'CGO': ('郑州', '郑州新郑'),
    'CGQ': ('长春', '长春龙嘉'),
    'CKG': ('重庆', '重庆江北'),
    'CSX': ('长沙', '长沙黄花'),
    'CTU': ('成都', '成都双流'),
    'CZX': ('常州', '常州奔牛'),
    'DAT': ('大同', '大同云冈'),
    'DLC': ('大连', '大连周水子'),
    'DLU': ('大理', '大理凤仪'),
    'DNH': ('敦煌', '敦煌莫高'),
    'DQA': ('大庆', '大庆萨尔图'),
    'DSN': ('鄂尔多斯', '鄂尔多斯伊金霍洛'),
    'ENH': ('恩施', '恩施许家坪'),
    'FOC': ('福州', '福州长乐'),
    'HAK': ('海口', '海口美兰'),
    'HET': ('呼和浩特', '呼和浩特白塔'),
    'HFE': ('合肥', '合肥新桥'),
    'HGH': ('杭州', '杭州萧山'),
    'HKG': ('香港', '香港'),
    'HLD': ('呼伦贝尔', '呼伦贝尔海拉尔'),
    'HRB': ('哈尔滨', '哈尔滨太平'),
    'INC': ('银川', '银川河东'),
    'JHG': ('西双版纳', '西双版纳嘎洒'),
    'JJN': ('泉州', '泉州晋江'),
    'JMU': ('佳木斯', '佳木斯东郊'),
    'JZH': ('九寨沟', '九寨沟黄龙'),
    'KHG': ('喀什', '喀什徕宁'),
    'KHN': ('南昌', '南昌昌北'),
    'KMG': ('昆明', '昆明长水'),
    'KOW': ('赣州', '赣州黄金'),
    'KRL': ('库尔勒', '库尔勒梨城'),
    'KWE': ('贵阳', '贵阳龙洞堡'),
    'KWL': ('桂林', '桂林两江'),
    'LHW': ('兰州', '兰州中川'),
    'LJG': ('丽江', '丽江三义'),
    'LXA': ('拉萨', '拉萨贡嘎'),
    'LYA': ('洛阳', '洛阳北郊'),
    'LYI': ('临沂', '临沂启阳'),
    'LZH': ('柳州', '柳州白莲'),
    'MFM': ('澳门', '澳门'),
    'MIG': ('绵阳', '绵阳南郊'),
    'NGB': ('宁波', '宁波栎社'),
    'NKG': ('南京', '南京禄口'),
    'NNG': ('南宁', '南宁吴圩'),
    'PEK': ('北京', '北京首都'),
    'PKX': ('北京', '北京大兴'),
    'PVG': ('上海', '上海浦东'),
    'SHA': ('上海', '上海虹桥'),
    'SHE': ('沈阳', '沈阳桃仙'),
    'SJW': ('石家庄', '石家庄正定'),
    'SWA': ('汕头', '揭阳潮汕'),
    'SYX': ('三亚', '三亚凤凰'),
    'SZX': ('深圳', '深圳宝安'),
    'TAO': ('青岛', '青岛胶东'),
    'TFU': ('成都', '成都天府'),
    'TNA': ('济南', '济南遥墙'),
    'TPE': ('台北', '台湾桃园'),
    'TSA': ('台北', '台北松山'),
    'TSN': ('天津', '天津滨海'),
    'TYN': ('太原', '太原武宿'),
    'URC': ('乌鲁木齐', '乌鲁木齐地窝堡'),
    'WEH': ('威海', '威海大水泊'),
    'WNZ': ('温州', '温州龙湾'),
    'WUH': ('武汉', '武汉天河'),
    'WUX': ('无锡', '苏南硕放'),
    'XIY': ('西安', '西安咸阳'),
    'XMN': ('厦门', '厦门高崎'),
    'XNN': ('西宁', '西宁曹家堡'),
    'XUZ': ('徐州', '徐州观音'),
    'YBP': ('宜宾', '宜宾五粮液'),
    'YIH': ('宜昌', '宜昌三峡'),
    'YNT': ('烟台', '烟台蓬莱'),
    'YTY': ('扬州', '扬州泰州'),
    'ZHA': ('湛江', '湛江吴川'),
    'ZUH': ('珠海', '珠海金湾'),
}

CHINA_AIRLINES_BY_IATA = {
    'A6': '湖南航空', 'AQ': '九元航空', 'BK': '奥凯航空',
    'CA': '中国国航', 'CN': '大新华航空', 'CZ': '中国南方航空',
    'DR': '瑞丽航空', 'DZ': '东海航空', 'EU': '成都航空',
    'FM': '上海航空', 'FU': '福州航空', 'G5': '华夏航空',
    'GJ': '长龙航空', 'GS': '天津航空', 'GT': '桂林航空',
    'GX': '北部湾航空', 'GY': '多彩贵州航空', 'HO': '吉祥航空',
    'HU': '海南航空', 'JD': '首都航空', 'JR': '幸福航空',
    'KN': '中国联合航空', 'KY': '昆明航空', 'MF': '厦门航空',
    'MU': '东方航空', 'NS': '河北航空', 'OQ': '重庆航空',
    'PN': '西部航空', 'QW': '青岛航空', 'RY': '江西航空',
    'SC': '山东航空', 'TV': '西藏航空', 'UQ': '乌鲁木齐航空',
    'VD': '河南航空', 'Y8': '金鹏航空', 'ZH': '深圳航空',
    'ZO': '七彩通航', '3U': '四川航空', '8C': '东星航空',
    '8L': '祥鹏航空', '9C': '春秋航空', '9D': '天骄航空',
    '9H': '长安航空',
}


def chinese_country_name(country_code):
    return CHINESE_COUNTRY_NAMES.get(str(country_code or '').upper())


ENGLISH_AIRLINE_NAMES = {
    'A6': 'Hunan Airlines', 'AQ': '9 Air', 'BK': 'Okay Airways',
    'CA': 'Air China', 'CN': 'Grand China Air', 'CZ': 'China Southern Airlines',
    'DR': 'Ruili Airlines', 'DZ': 'Donghai Airlines', 'EU': 'Chengdu Airlines',
    'FM': 'Shanghai Airlines', 'FU': 'Fuzhou Airlines', 'G5': 'China Express Airlines',
    'GJ': 'Loong Air', 'GS': 'Tianjin Airlines', 'GT': 'Air Guilin',
    'GX': 'GX Airlines', 'GY': 'Colorful Guizhou Airlines', 'HO': 'Juneyao Airlines',
    'HU': 'Hainan Airlines', 'JD': 'Beijing Capital Airlines', 'JR': 'Joy Air',
    'KN': 'China United Airlines', 'KY': 'Kunming Airlines', 'MF': 'Xiamen Airlines',
    'MU': 'China Eastern Airlines', 'NS': 'Hebei Airlines', 'OQ': 'Chongqing Airlines',
    'PN': 'West Air', 'QW': 'Qingdao Airlines', 'RY': 'Jiangxi Air',
    'SC': 'Shandong Airlines', 'TV': 'Tibet Airlines', 'UQ': 'Urumqi Air',
    'VD': 'Henan Airlines', 'Y8': 'Suparna Airlines', 'ZH': 'Shenzhen Airlines',
    'ZO': 'Colorful General Aviation', '3U': 'Sichuan Airlines', '8C': 'East Star Airlines',
    '8L': 'Lucky Air', '9C': 'Spring Airlines', '9D': 'Genghis Khan Airlines', '9H': 'Air Changan',
}

# Corrections to historical names in the bundled airportsdata snapshot.
ENGLISH_AIRPORT_OVERRIDES = {
    'KMG': 'Kunming Changshui International Airport',
    'SJW': 'Shijiazhuang Zhengding International Airport',
    'HKG': 'Hong Kong International Airport',
    'HET': 'Hohhot Baita International Airport',
    'HRB': 'Harbin Taiping International Airport',
    'SHE': 'Shenyang Taoxian International Airport',
}


def bilingual_name(english, chinese):
    return f"{english} ({chinese})"


@lru_cache(maxsize=1)
def china_city_names():
    import airportsdata
    airports = airportsdata.load('IATA')
    names = {}
    for code, (chinese, _) in CHINA_AIRPORTS_BY_IATA.items():
        english = airports.get(code, {}).get('city')
        if english:
            names.setdefault(chinese, english)
    return names


def localized_china_city(name, country_code=None):
    """Normalize known Chinese/English/bilingual aliases without changing IDs."""
    value = str(name or '').strip()
    if country_code and str(country_code).upper() not in CHINESE_REGION_CODES:
        return value
    for chinese, english in china_city_names().items():
        canonical = bilingual_name(english, chinese)
        if value.casefold() in {chinese.casefold(), english.casefold(), canonical.casefold(), f'{english}（{chinese}）'.casefold()}:
            return canonical
    return value


def localized_china_airport(info, iata=None, icao=None):
    """Return bilingual city/airport/country names, or None outside China."""
    country_code = str((info or {}).get('country') or '').upper()
    if country_code not in CHINESE_REGION_CODES:
        return None
    iata_code = str(iata or (info or {}).get('iata') or '').upper()
    code = iata_code or str(icao or (info or {}).get('icao') or '').upper()
    mapped = CHINA_AIRPORTS_BY_IATA.get(iata_code)
    import airportsdata
    standard = airportsdata.load('IATA').get(iata_code, {})
    english_airport = ENGLISH_AIRPORT_OVERRIDES.get(iata_code) or standard.get('name') or (info or {}).get('name') or f'Airport {code}'
    if mapped:
        city_name, airport_name = mapped
        english_city = china_city_names().get(city_name) or standard.get('city') or (info or {}).get('city') or code
    else:
        city_name = airport_name = '中文名待补充'
        english_city = (info or {}).get('city') or f'City {code}'
    return {
        'city': bilingual_name(english_city, city_name),
        'airport': bilingual_name(english_airport, airport_name),
        'country': chinese_country_name(country_code),
        'country_code': country_code,
    }


def chinese_airline_name(iata):
    code = str(iata or '').upper()
    chinese = CHINA_AIRLINES_BY_IATA.get(code)
    return bilingual_name(ENGLISH_AIRLINE_NAMES[code], chinese) if chinese else None


def localized_china_airline_alias(name):
    value = str(name or '').strip()
    for code, chinese in CHINA_AIRLINES_BY_IATA.items():
        english = ENGLISH_AIRLINE_NAMES[code]
        if value.casefold() in {chinese.casefold(), english.casefold(), bilingual_name(english, chinese).casefold()}:
            return bilingual_name(english, chinese)
    return value


ALLIANCE_NAMES = {'Star Alliance': '星空联盟', 'SkyTeam': '天合联盟', 'Oneworld': '寰宇一家'}


def bilingual_alliance(value):
    if not value:
        return value
    value = str(value).strip()
    for english, chinese in ALLIANCE_NAMES.items():
        if value.casefold() in {english.casefold(), chinese, bilingual_name(english, chinese).casefold(), f'{english}（{chinese}）'.casefold()}:
            return bilingual_name(english, chinese)
    return value
