import database
import airportsdata
import sqlite3

def sync_timezones():
    print("Starting sync...")
    # Ensure migration (manual check for script usage)
    conn = database.get_db()
    
    # Cities Timezone
    try:
        cur = conn.execute("PRAGMA table_info(cities)")
        cols = [r[1] for r in cur.fetchall()]
        if 'timezone' not in cols:
            print("Adding timezone column to cities...")
            conn.execute("ALTER TABLE cities ADD COLUMN timezone TEXT")
    except Exception as e:
        print(f"Migration error: {e}")

    # Airports Timezone
    try:
        cur = conn.execute("PRAGMA table_info(airports)")
        cols = [r[1] for r in cur.fetchall()]
        if 'timezone' not in cols:
            print("Adding timezone column to airports...")
            conn.execute("ALTER TABLE airports ADD COLUMN timezone TEXT")
    except Exception as e:
        print(f"Migration error: {e}")
        
    # Load Data
    ad = airportsdata.load('ICAO')
    ad_iata = airportsdata.load('IATA')
    
    # 1. Update Cities from AirportsData (using existing airports to find cities)
    # Get all airports
    cur = conn.execute("SELECT id, icao_code, iata_code, city_id, timezone FROM airports")
    airports = cur.fetchall()
    
    updates_city = 0
    updates_airport = 0
    
    for apt in airports:
        aid, icao, iata, cid, curr_tz = apt
        tz = None
        
        # Resolve TZ from library
        if icao and icao in ad:
            tz = ad[icao].get('tz')
        elif iata and iata in ad_iata:
            tz = ad_iata[iata].get('tz')
            
        if not tz: continue
        
        # Update City if missing
        if cid:
            # Check city
            c_row = conn.execute("SELECT timezone FROM cities WHERE id = ?", (cid,)).fetchone()
            if c_row and not c_row[0]:
                conn.execute("UPDATE cities SET timezone = ? WHERE id = ?", (tz, cid))
                updates_city += 1
                
        # Update Airport if missing or mismatch (user wants sync)
        # Actually user said "Airport timezone should be set according to City"
        # So we should establish City timezone first.
        
    conn.commit()
    print(f"Populated {updates_city} cities with timezones.")

    # 2. Sync Airport Timezone FROM City Timezone
    cur = conn.execute("SELECT a.id, c.timezone FROM airports a JOIN cities c ON a.city_id = c.id WHERE c.timezone IS NOT NULL")
    pairs = cur.fetchall()
    
    for aid, c_tz in pairs:
        conn.execute("UPDATE airports SET timezone = ? WHERE id = ?", (c_tz, aid))
        updates_airport += 1
        
    conn.commit()
    print(f"Synced {updates_airport} airports to city timezones.")
    conn.close()

if __name__ == '__main__':
    sync_timezones()
