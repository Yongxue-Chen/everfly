"""Aviation weather (METAR) client with in-memory caching.

Primary source: AVWX REST API (https://avwx.rest)
Fallback source: NOAA Aviation Weather Center (https://aviationweather.gov)

Usage:
    from weather import fetch_metar
    data = fetch_metar("ZBAA")  # returns dict or None
"""

from __future__ import annotations

import os
import re
import time
import logging
import requests as _requests

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

AVWX_API_KEY = os.environ.get("AVWX_API_KEY", "").strip()
CACHE_TTL_SECONDS = int(os.environ.get("WEATHER_CACHE_TTL", 1800))  # 30 min

# ---------------------------------------------------------------------------
# In-memory cache  {icao: (timestamp, data_dict)}
# ---------------------------------------------------------------------------

_cache: dict[str, tuple[float, dict]] = {}

_ICAO_RE = re.compile(r"^[A-Z]{4}$")

# ---------------------------------------------------------------------------
# Flight-rules colour mapping
# ---------------------------------------------------------------------------

_FLIGHT_RULES_EMOJI = {
    "VFR": "🟢",
    "MVFR": "🔵",
    "IFR": "🔴",
    "LIFR": "🟣",
}

# ---------------------------------------------------------------------------
# Weather condition → emoji mapping
# ---------------------------------------------------------------------------

_CONDITION_EMOJI = {
    "Clear": "☀️",
    "Few Clouds": "🌤️",
    "Scattered Clouds": "⛅",
    "Broken Clouds": "🌥️",
    "Overcast": "☁️",
    "Fog": "🌫️",
    "Mist": "🌫️",
    "Haze": "🌫️",
    "Rain": "🌧️",
    "Drizzle": "🌦️",
    "Snow": "🌨️",
    "Thunderstorm": "⛈️",
}


def _cloud_summary(clouds):
    """Summarise AVWX cloud layers into a human-readable string."""
    if not clouds:
        return "Clear"
    _cover_labels = {
        "FEW": "Few Clouds",
        "SCT": "Scattered Clouds",
        "BKN": "Broken Clouds",
        "OVC": "Overcast",
        "CLR": "Clear",
        "SKC": "Clear",
        "NCD": "Clear",
        "NSC": "Clear",
        "VV": "Obscured",
    }
    # Return the most significant (last) cloud layer description
    for layer in reversed(clouds):
        cover = layer.get("type") or ""
        label = _cover_labels.get(cover.upper())
        if label:
            return label
    return "Clouds"


def _wx_summary(wx_codes):
    """Summarise AVWX wx_codes into a human-readable string."""
    if not wx_codes:
        return None
    descriptions = []
    for code in wx_codes:
        val = code.get("value") or code.get("repr") or ""
        if val:
            descriptions.append(val)
    return ", ".join(descriptions) if descriptions else None


# ---------------------------------------------------------------------------
# AVWX client
# ---------------------------------------------------------------------------

def _fetch_avwx(icao: str) -> dict | None:
    """Fetch decoded METAR from AVWX REST API."""
    if not AVWX_API_KEY:
        return None
    try:
        resp = _requests.get(
            f"https://avwx.rest/api/metar/{icao}",
            headers={"Authorization": AVWX_API_KEY},
            params={"options": "info"},
            timeout=8,
        )
        if resp.status_code != 200:
            logger.warning("AVWX %s returned %d", icao, resp.status_code)
            return None
        return _normalise_avwx(resp.json(), icao)
    except Exception as exc:
        logger.warning("AVWX fetch error for %s: %s", icao, exc)
        return None


def _safe_float(value):
    """Extract a float from an AVWX value dict or raw value."""
    if value is None:
        return None
    if isinstance(value, dict):
        v = value.get("value")
        return float(v) if v is not None else None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _normalise_avwx(data: dict, icao: str) -> dict:
    """Transform AVWX JSON into our standard format."""
    clouds = data.get("clouds") or []
    cloud_text = _cloud_summary(clouds)
    wx_text = _wx_summary(data.get("wx_codes"))
    condition = wx_text or cloud_text

    flight_rules = (data.get("flight_rules") or "").upper()

    temp = _safe_float(data.get("temperature"))
    dewpoint = _safe_float(data.get("dewpoint"))

    wind_dir = _safe_float(data.get("wind_direction"))
    wind_speed = _safe_float(data.get("wind_speed"))
    wind_gust = _safe_float(data.get("wind_gust"))

    vis = data.get("visibility")
    visibility_m = _safe_float(vis)

    pressure = _safe_float(data.get("altimeter"))

    # Pick a display emoji
    condition_emoji = _CONDITION_EMOJI.get(cloud_text, "🌤️")
    if wx_text:
        for key in _CONDITION_EMOJI:
            if key.lower() in wx_text.lower():
                condition_emoji = _CONDITION_EMOJI[key]
                break

    return {
        "icao": icao,
        "raw": data.get("raw") or "",
        "condition": condition,
        "condition_emoji": condition_emoji,
        "temperature": temp,
        "dewpoint": dewpoint,
        "wind_direction": wind_dir,
        "wind_speed": wind_speed,
        "wind_gust": wind_gust,
        "wind_unit": "kt",
        "visibility_m": visibility_m,
        "clouds": cloud_text,
        "flight_rules": flight_rules,
        "flight_rules_emoji": _FLIGHT_RULES_EMOJI.get(flight_rules, ""),
        "pressure": pressure,
        "observation_time": data.get("time", {}).get("dt") if isinstance(data.get("time"), dict) else data.get("time"),
        "source": "avwx",
    }


# ---------------------------------------------------------------------------
# NOAA AWC fallback
# ---------------------------------------------------------------------------

def _fetch_noaa(icao: str) -> dict | None:
    """Fetch METAR from NOAA Aviation Weather Center as fallback."""
    try:
        resp = _requests.get(
            "https://aviationweather.gov/api/data/metar",
            params={"ids": icao, "format": "json"},
            timeout=8,
        )
        if resp.status_code != 200:
            logger.warning("NOAA AWC %s returned %d", icao, resp.status_code)
            return None
        items = resp.json()
        if not items:
            return None
        return _normalise_noaa(items[0], icao)
    except Exception as exc:
        logger.warning("NOAA AWC fetch error for %s: %s", icao, exc)
        return None


def _normalise_noaa(data: dict, icao: str) -> dict:
    """Transform NOAA AWC JSON into our standard format."""
    raw = data.get("rawOb") or ""

    temp = _safe_float(data.get("temp"))
    dewpoint = _safe_float(data.get("dewp"))
    wind_dir = _safe_float(data.get("wdir"))
    wind_speed = _safe_float(data.get("wspd"))
    wind_gust = _safe_float(data.get("wgst"))
    visibility_m = None
    visib = data.get("visib")
    if visib is not None:
        try:
            # NOAA reports visibility in statute miles
            visibility_m = float(visib) * 1609.34
        except (TypeError, ValueError):
            pass

    pressure = _safe_float(data.get("altim"))

    cloud_text = _noaa_cloud_summary(data.get("clouds"))
    flight_rules = _derive_flight_rules(visibility_m, data.get("clouds"))

    condition_emoji = _CONDITION_EMOJI.get(cloud_text, "🌤️")

    return {
        "icao": icao,
        "raw": raw,
        "condition": cloud_text,
        "condition_emoji": condition_emoji,
        "temperature": temp,
        "dewpoint": dewpoint,
        "wind_direction": wind_dir,
        "wind_speed": wind_speed,
        "wind_gust": wind_gust,
        "wind_unit": "kt",
        "visibility_m": visibility_m,
        "clouds": cloud_text,
        "flight_rules": flight_rules,
        "flight_rules_emoji": _FLIGHT_RULES_EMOJI.get(flight_rules, ""),
        "pressure": pressure,
        "observation_time": data.get("reportTime"),
        "source": "noaa",
    }


def _noaa_cloud_summary(clouds):
    if not clouds:
        return "Clear"
    _cover_labels = {
        "FEW": "Few Clouds",
        "SCT": "Scattered Clouds",
        "BKN": "Broken Clouds",
        "OVC": "Overcast",
        "CLR": "Clear",
        "SKC": "Clear",
    }
    for layer in reversed(clouds):
        cover = layer.get("cover") or ""
        label = _cover_labels.get(cover.upper())
        if label:
            return label
    return "Clouds"


def _derive_flight_rules(visibility_m, clouds):
    """Derive flight rules from visibility and cloud data."""
    # Ceiling: lowest BKN or OVC layer altitude in feet
    ceiling_ft = None
    if clouds:
        for layer in clouds:
            cover = (layer.get("cover") or "").upper()
            if cover in ("BKN", "OVC", "VV"):
                base = layer.get("base")
                if base is not None:
                    try:
                        ceiling_ft = int(base)
                        break  # lowest significant ceiling
                    except (TypeError, ValueError):
                        pass

    vis_sm = None
    if visibility_m is not None:
        vis_sm = visibility_m / 1609.34  # convert back to statute miles

    # LIFR: ceiling < 500 ft or visibility < 1 SM
    if (ceiling_ft is not None and ceiling_ft < 500) or (vis_sm is not None and vis_sm < 1):
        return "LIFR"
    # IFR: ceiling 500-999 ft or visibility 1-2.99 SM
    if (ceiling_ft is not None and ceiling_ft < 1000) or (vis_sm is not None and vis_sm < 3):
        return "IFR"
    # MVFR: ceiling 1000-2999 ft or visibility 3-4.99 SM
    if (ceiling_ft is not None and ceiling_ft < 3000) or (vis_sm is not None and vis_sm < 5):
        return "MVFR"
    return "VFR"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def fetch_metar(icao: str) -> dict | None:
    """Return METAR data for the given ICAO code, using cache when fresh.

    Returns None if the ICAO is invalid or no data could be retrieved.
    """
    icao = (icao or "").strip().upper()
    if not _ICAO_RE.match(icao):
        return None

    now = time.time()
    cached = _cache.get(icao)
    if cached:
        ts, data = cached
        if now - ts < CACHE_TTL_SECONDS:
            return {**data, "cached": True, "cache_age_seconds": int(now - ts)}

    # Try AVWX first, fall back to NOAA
    result = _fetch_avwx(icao) or _fetch_noaa(icao)
    if result:
        _cache[icao] = (now, result)
        result["cached"] = False
        result["cache_age_seconds"] = 0
    return result


def clear_cache():
    """Clear the in-memory weather cache (useful for testing)."""
    _cache.clear()
