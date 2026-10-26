"""Optional single sign-on through a trusted cookie set by another app.

A sibling app (the identity provider) can log users in for everfly: it sets a
cookie on the shared parent domain holding an HS256 JWT signed with a secret
both apps know. everfly verifies the signature itself, maps the token's email to
a local username, and (optionally) asks the provider whether the token is still
valid, so logging out or changing the password there also logs out here.

Disabled unless SSO_SECRET and SSO_LOGIN_URL are set. Configuration:

    SSO_SECRET          shared HS256 secret
    SSO_LOGIN_URL       provider login; ``?next=<everfly URL>`` is appended
    SSO_LOGOUT_URL      provider logout (optional)
    SSO_CHECK_URL       POST {"token": ...} -> 200 valid / 401 revoked (optional)
    SSO_USER_MAP        "email:username,email2:username2"
    SSO_COOKIE_NAME     default "ever_sso"
    SSO_ISSUER          default "evertravel"
    SSO_AUDIENCE        default "ever-sso"
    SSO_PROVIDER_NAME   label for the login button, default "single sign-on"
"""
import base64
import hashlib
import hmac
import json
import os
import time
from urllib.parse import urlencode

import requests

CHECK_TTL_SECONDS = 300
_check_cache = {}


def config(environ=None):
    env = os.environ if environ is None else environ
    secret = env.get('SSO_SECRET', '')
    login_url = env.get('SSO_LOGIN_URL', '')
    if not secret or not login_url:
        return None
    user_map = {}
    for pair in env.get('SSO_USER_MAP', '').split(','):
        email, _, username = pair.strip().partition(':')
        if email and username:
            user_map[email.strip().lower()] = username.strip().lower()
    return {
        'secret': secret,
        'login_url': login_url,
        'logout_url': env.get('SSO_LOGOUT_URL', ''),
        'check_url': env.get('SSO_CHECK_URL', ''),
        'cookie_name': env.get('SSO_COOKIE_NAME', 'ever_sso'),
        'issuer': env.get('SSO_ISSUER', 'evertravel'),
        'audience': env.get('SSO_AUDIENCE', 'ever-sso'),
        'provider_name': env.get('SSO_PROVIDER_NAME', 'single sign-on'),
        'user_map': user_map,
    }


def _b64decode(value):
    return base64.urlsafe_b64decode(value + '=' * (-len(value) % 4))


def verify_token(token, cfg, now=None):
    """Return the claims of a correctly signed, unexpired token, else None."""
    if not token or not cfg:
        return None
    parts = token.split('.')
    if len(parts) != 3:
        return None
    try:
        header = json.loads(_b64decode(parts[0]))
        if header.get('alg') != 'HS256':
            return None
        expected = hmac.new(cfg['secret'].encode(), f'{parts[0]}.{parts[1]}'.encode(), hashlib.sha256).digest()
        if not hmac.compare_digest(expected, _b64decode(parts[2])):
            return None
        claims = json.loads(_b64decode(parts[1]))
    except (ValueError, TypeError):
        return None
    if claims.get('iss') != cfg['issuer'] or claims.get('aud') != cfg['audience']:
        return None
    exp = claims.get('exp')
    if not isinstance(exp, (int, float)) or exp <= (time.time() if now is None else now):
        return None
    return claims


def still_valid(token, cfg, post=requests.post):
    """Ask the provider; cached for a few minutes. Unreachable provider -> trust the signature."""
    if not cfg.get('check_url'):
        return True
    cached = _check_cache.get(token)
    if cached and cached[1] > time.time():
        return cached[0]
    try:
        res = post(cfg['check_url'], json={'token': token}, timeout=3)
    except requests.RequestException:
        return True
    if res.status_code == 401:
        ok = False
    elif 200 <= res.status_code < 300:
        ok = True
    else:
        return True
    if len(_check_cache) > 500:
        _check_cache.clear()
    _check_cache[token] = (ok, time.time() + CHECK_TTL_SECONDS)
    return ok


def username_for_token(token, cfg, post=requests.post):
    """Local username this SSO token logs in as, or None."""
    claims = verify_token(token, cfg)
    if not claims:
        return None
    username = cfg['user_map'].get(str(claims.get('email', '')).lower())
    if not username or not still_valid(token, cfg, post):
        return None
    return username


def login_url(cfg, return_to):
    sep = '&' if '?' in cfg['login_url'] else '?'
    return f"{cfg['login_url']}{sep}{urlencode({'next': return_to})}"


def logout_url(cfg, return_to):
    if not cfg.get('logout_url'):
        return None
    sep = '&' if '?' in cfg['logout_url'] else '?'
    return f"{cfg['logout_url']}{sep}{urlencode({'next': return_to})}"
