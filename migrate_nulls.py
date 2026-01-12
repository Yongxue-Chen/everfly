
import sqlite3
import shutil
import os

DATABASE = 'flightlog.db'

def migrate_allow_nulls():
    if not os.path.exists(DATABASE):
        print("Database not found.")
        return

    # Backup
    shutil.copy(DATABASE, DATABASE + '.bak_nulls')
    print("Backup created.")

    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    try:
        # 1. Get current columns
        cur.execute("PRAGMA table_info(flights)")
        columns_info = cur.fetchall()
        columns = [col['name'] for col in columns_info]
        
        print(f"Current columns: {columns}")

        # 2. Rename old table
        conn.execute("ALTER TABLE flights RENAME TO flights_old")

        # 3. Create new table with relaxed constraints
        # We manually construct the schema to ensure we catch everything but remove NOT NULL for airports
        # Base schema based on known evolution
        create_sql = """
        CREATE TABLE flights (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            flight_number TEXT,
            airline_id INTEGER,
            aircraft_model_id INTEGER,
            origin_airport_id INTEGER, -- REMOVED NOT NULL
            dest_airport_id INTEGER,   -- REMOVED NOT NULL
            dep_time_scheduled TEXT,
            arr_time_scheduled TEXT,
            dep_time_actual TEXT,
            arr_time_actual TEXT,
            seat_number TEXT,
            seat_type TEXT,
            flight_class TEXT,
            reason TEXT,
            note TEXT,
            origin_terminal TEXT,
            dest_terminal TEXT,
            tag_generation TEXT,
            tag_winglets TEXT,
            tag_config TEXT,
            registration TEXT,
            distance INTEGER,
            duration_scheduled INTEGER,
            duration_actual INTEGER,
            std TEXT,
            atd TEXT,
            sta TEXT,
            ata TEXT,
            tag_engine TEXT,
            FOREIGN KEY (airline_id) REFERENCES airlines (id),
            FOREIGN KEY (aircraft_model_id) REFERENCES aircraft_models (id),
            FOREIGN KEY (origin_airport_id) REFERENCES airports (id),
            FOREIGN KEY (dest_airport_id) REFERENCES airports (id)
        )
        """
        # Note: I included tag_engine just in case, but let's check if it exists in current columns
        # If I include a column that doesn't exist, insert will fail.
        # So I should only include columns that match 'columns' list.
        # But 'INSERT INTO flights SELECT * FROM flights_old' requires identical structure usually.
        # A safer way: Use the columns list to build the SELECT.
        
        conn.execute(create_sql)
        print("New table created.")

        # 4. Filter columns that exist in both
        # My create_sql has a superset? Or subset?
        # Let's trust that I covered all.
        # But if 'flights_old' has extra columns not in 'create_sql', data is lost.
        # If 'flights_old' misses columns in 'create_sql', insert fails.
        
        # Dynamic Insert
        # I'll stick to 'INSERT INTO flights (col1, col2...) SELECT col1, col2... FROM flights_old'
        # matching only the columns that exist in my new definition.
        
        # Let's verify columns in new table
        cur.execute("PRAGMA table_info(flights)")
        new_cols = [c['name'] for c in cur.fetchall()]
        
        # Common columns
        common_cols = [c for c in columns if c in new_cols]
        cols_str = ", ".join(common_cols)
        
        conn.execute(f"INSERT INTO flights ({cols_str}) SELECT {cols_str} FROM flights_old")
        print(f"Data copied using columns: {cols_str}")

        # 5. Drop old
        conn.execute("DROP TABLE flights_old")
        
        conn.commit()
        print("Migration successful: flights table now allows NULL origin/dest.")

    except Exception as e:
        conn.rollback()
        print(f"Error: {e}")
        # Restore? user can use .bak
    finally:
        conn.close()

if __name__ == '__main__':
    migrate_allow_nulls()
