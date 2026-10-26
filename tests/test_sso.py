import base64
import hashlib
import hmac
import json
import time
import unittest

import requests

import sso

SECRET = 'test-sso-secret'


def _b64(value):
    return base64.urlsafe_b64encode(json.dumps(value).encode()).rstrip(b'=').decode()


def sign(claims, secret=SECRET, header=None):
    body = f"{_b64(header or {'alg': 'HS256', 'typ': 'JWT'})}.{_b64(claims)}"
    sig = hmac.new(secret.encode(), body.encode(), hashlib.sha256).digest()
    return body + '.' + base64.urlsafe_b64encode(sig).rstrip(b'=').decode()


def good(**overrides):
    claims = {'sub': '5', 'email': 'Owner@Example.com', 'sv': 0, 'iss': 'evertravel',
              'aud': 'ever-sso', 'exp': int(time.time()) + 3600}
    claims.update(overrides)
    return sign(claims)


def cfg(**overrides):
    env = {'SSO_SECRET': SECRET, 'SSO_LOGIN_URL': 'https://travel.example.com/auth/sso',
           'SSO_USER_MAP': 'owner@example.com:Pilot'}
    env.update(overrides)
    return sso.config(env)


class FakeResponse:
    def __init__(self, status_code):
        self.status_code = status_code


class SsoTests(unittest.TestCase):
    def setUp(self):
        sso._check_cache.clear()

    def test_disabled_without_secret_and_login_url(self):
        self.assertIsNone(sso.config({}))
        self.assertIsNone(sso.config({'SSO_SECRET': 'x'}))
        self.assertEqual(cfg()['user_map'], {'owner@example.com': 'pilot'})

    def test_valid_token_maps_email_to_username(self):
        self.assertEqual(sso.username_for_token(good(), cfg()), 'pilot')

    def test_unmapped_email_is_rejected(self):
        self.assertIsNone(sso.username_for_token(good(email='friend@example.com'), cfg()))

    def test_forged_foreign_or_expired_tokens_are_rejected(self):
        c = cfg()
        self.assertIsNone(sso.verify_token(sign({'sub': '5'}, secret='other'), c))
        self.assertIsNone(sso.verify_token(good(aud='other'), c))
        self.assertIsNone(sso.verify_token(good(iss='other'), c))
        self.assertIsNone(sso.verify_token(good(exp=int(time.time()) - 1), c))
        self.assertIsNone(sso.verify_token(sign({'sub': '5', 'iss': 'evertravel', 'aud': 'ever-sso',
                                                 'exp': int(time.time()) + 60}, header={'alg': 'none'}), c))
        head, _, sig = good().split('.')
        tampered = _b64({'sub': '6', 'email': 'owner@example.com', 'iss': 'evertravel',
                         'aud': 'ever-sso', 'exp': int(time.time()) + 60})
        self.assertIsNone(sso.verify_token(f'{head}.{tampered}.{sig}', c))
        self.assertIsNone(sso.verify_token('garbage', c))
        self.assertIsNone(sso.verify_token('', c))

    def test_provider_revocation_and_outage(self):
        c = cfg(SSO_CHECK_URL='http://idp/api/internal/sso/session')
        self.assertIsNone(sso.username_for_token(good(sv=1), c, post=lambda *a, **k: FakeResponse(401)))

        def down(*a, **k):
            raise requests.ConnectionError('refused')
        self.assertEqual(sso.username_for_token(good(sv=2), c, post=down), 'pilot')

        calls = []

        def ok(url, json, timeout):
            calls.append(json['token'])
            return FakeResponse(200)
        token = good(sv=3)
        sso.username_for_token(token, c, post=ok)
        sso.username_for_token(token, c, post=ok)
        self.assertEqual(len(calls), 1)

    def test_login_and_logout_urls(self):
        c = cfg(SSO_LOGOUT_URL='https://travel.example.com/auth/sso/logout')
        self.assertEqual(sso.login_url(c, 'https://flight.example.com/'),
                         'https://travel.example.com/auth/sso?next=https%3A%2F%2Fflight.example.com%2F')
        self.assertEqual(sso.logout_url(c, 'https://flight.example.com/'),
                         'https://travel.example.com/auth/sso/logout?next=https%3A%2F%2Fflight.example.com%2F')
        self.assertIsNone(sso.logout_url(cfg(), 'https://flight.example.com/'))


if __name__ == '__main__':
    unittest.main()
