from app import app, query_db, database
from flask import g
import sqlite3

with app.app_context():
    # Mock user setup
    g.user = {'id': 1, 'username': 'test', 'db_filename': 'c:\\users\\test\\flightlog.db'}
    g.db_path = 'flightlog.db' 
    
    print("--- Test Start ---")
    
    # 1. Open DB
    conn = database.get_db()
    print(f"Step 1: DB Acquired")
    
    # 2. Run query (should NOT close db)
    print("Step 2: Running query_db...")
    try:
        query_db("SELECT 1")
        print("Step 2: Success")
    except Exception as e:
        print(f"Step 2 Error: {e}")
        
    # 3. Check if still open by using raw connection
    print("Step 3: Verifying connection still open...")
    try:
        conn.execute("SELECT 1")
        print("Step 3: Success - DB Still Open!")
    except Exception as e:
        print(f"Step 3 FAILED: {e}")

    print("--- Test End ---")
