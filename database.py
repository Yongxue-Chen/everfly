import os
import pymysql
import pymysql.cursors
from flask import g


def _raw_connect(dict_cursor=False):
    cursor_class = pymysql.cursors.DictCursor if dict_cursor else pymysql.cursors.Cursor
    return pymysql.connect(
        host=os.environ.get('MYSQL_HOST', 'localhost'),
        port=int(os.environ.get('MYSQL_PORT', 3306)),
        user=os.environ.get('MYSQL_USER', 'root'),
        password=os.environ.get('MYSQL_PASSWORD', ''),
        database=os.environ.get('MYSQL_DB', 'flightlog'),
        charset='utf8mb4',
        cursorclass=cursor_class,
        autocommit=False,
    )


class _DBWrapper:
    """
    Thin compatibility shim so the rest of the app can call conn.execute()
    just like sqlite3, while underneath using PyMySQL.

    - get_db()       → regular Cursor → fetchone()/fetchall() return tuples
    - get_users_db() → DictCursor    → fetchone()/fetchall() return dicts
    - '?' placeholders are auto-converted to '%s' for PyMySQL.
    """

    def __init__(self, raw_conn):
        self._conn = raw_conn

    def execute(self, query, args=()):
        query = query.replace('?', '%s')
        cur = self._conn.cursor()
        cur.execute(query, tuple(args))
        return cur

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        try:
            self._conn.close()
        except Exception:
            pass


def get_db():
    """Per-request connection (tuple rows). Closed by teardown_appcontext."""
    if 'db' not in g:
        g.db = _DBWrapper(_raw_connect(dict_cursor=False))
    return g.db


def get_users_db():
    """
    Fresh connection for user-auth queries (dict rows).
    Caller is responsible for calling .close().
    """
    return _DBWrapper(_raw_connect(dict_cursor=True))


def migrate_users_db():
    """Ensure api_key_encrypted column exists in the users table (MySQL version)."""
    try:
        conn = get_users_db()
        cur = conn.execute("""
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME   = 'users'
              AND COLUMN_NAME  = 'api_key_encrypted'
        """)
        if not cur.fetchone():
            conn.execute("ALTER TABLE users ADD COLUMN api_key_encrypted TEXT")
            conn.commit()
            print("Migrated users table: added api_key_encrypted column")
        conn.close()
    except Exception as e:
        print(f"migrate_users_db error: {e}")


def init_db(target_db_path=None):
    """No-op in MySQL mode — schema is managed via schema_mysql.sql."""
    pass

