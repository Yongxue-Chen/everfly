import sqlite3
import os
from flask import g

USERS_DB_PATH = 'users.db'

def get_db():
    if 'db' not in g:
        # Default to None or error if not set, but for now fallback to flightlog.db for backward compat if needed? 
        # Better: Rely on g.db_path being set by auth middleware
        db_path = getattr(g, 'db_path', None)
        if not db_path:
            # Fallback for scripts or before auth fully implemented? 
            # Or maybe just error out to ensure strictness.
            # Let's fallback to flightlog.db only if specifically requested or legacy/dev mode.
            # For strict multi-user, we should require g.db_path.
            # However, for migration scripts, we might need manual override.
            db_path = 'flightlog.db' 
            
        g.db = sqlite3.connect(db_path)
        g.db.row_factory = sqlite3.Row
    return g.db

def get_users_db():
    conn = sqlite3.connect(USERS_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db(target_db_path=None):
    # If target provided, init that. Else init current g.db_path
    path = target_db_path
    if not path:
        path = getattr(g, 'db_path', 'flightlog.db')

    # Ensure dir exists
    dirname = os.path.dirname(path)
    if dirname and not os.path.exists(dirname):
        os.makedirs(dirname)

    conn = sqlite3.connect(path)
    with open('schema.sql', 'r') as f:
        conn.executescript(f.read())
    conn.commit()
    conn.close()

