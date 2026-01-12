import database
import airportsdata
import sqlite3

def upgrade_schema():
    conn = database.get_db()
    try:
        cur = conn.execute("PRAGMA table_info(cities)")
        cols = [r[1] for r in cur.fetchall()]
        if 'continent' not in cols:
             print("Adding continent column to cities...")
             conn.execute("ALTER TABLE cities ADD COLUMN continent TEXT")
        
        cur = conn.execute("PRAGMA table_info(airlines)")
        cols = [r[1] for r in cur.fetchall()]
        if 'alliance' not in cols:
             print("Adding alliance column to airlines...")
             conn.execute("ALTER TABLE airlines ADD COLUMN alliance TEXT")
        conn.commit()
    except Exception as e:
        print(f"Migration error: {e}")
    finally:
        conn.close()

def fix_stats():
    upgrade_schema()
    
    conn = database.get_db()
    
    # 1. Backfill Continents
    print("Backfilling continents...")
    ad = airportsdata.load('ICAO')
    ad_iata = airportsdata.load('IATA')
    
    # Reload schema knowledge by new query
    try:
        cur = conn.execute("SELECT c.id, c.name, a.icao_code, a.iata_code FROM cities c JOIN airports a ON a.city_id = c.id WHERE c.continent IS NULL")
        rows = cur.fetchall()
        
        city_updates = {} # id -> continent
        
        for row in rows:
            cid, cname, icao, iata = row
            cont = None
            if icao and icao in ad:
                cont = ad[icao].get('continent')
            elif iata and iata in ad_iata:
                cont = ad_iata[iata].get('continent')
                
            if cont:
                city_updates[cid] = cont
                
        for cid, cont in city_updates.items():
            conn.execute("UPDATE cities SET continent = ? WHERE id = ?", (cont, cid))
            
        print(f"Updated {len(city_updates)} cities with continent.")

        # 2. Backfill Alliances
        print("Backfilling alliances...")
        alliances = {
            'SkyTeam': ['DL', 'AF', 'KL', 'MU', 'CZ', 'KE', 'AZ', 'CI', 'SU', 'VN', 'RO', 'AR', 'AM', 'UX', 'SV', 'ME', 'KQ', 'GA', 'MF'],
            'Star Alliance': ['UA', 'LH', 'CA', 'NH', 'SQ', 'SK', 'TG', 'OS', 'LX', 'TK', 'AC', 'NZ', 'SA', 'MS', 'AI', 'BR', 'CM', 'TP', 'A3', 'OU', 'ZH'],
            'Oneworld': ['AA', 'BA', 'CX', 'QF', 'JL', 'IB', 'AY', 'QR', 'MH', 'RJ', 'S7', 'UL', 'AT', 'AS']
        }
        
        count = 0
        for alliance, airlines_list in alliances.items():
            for code in airlines_list:
                res = conn.execute("UPDATE airlines SET alliance = ? WHERE iata_code = ? AND (alliance IS NULL OR alliance = '')", (alliance, code))
                count += res.rowcount
                
        print(f"Updated {count} airlines with alliance.")
        conn.commit()
    except Exception as e:
        print(f"Update error: {e}")
    finally:
        conn.close()

if __name__ == '__main__':
    fix_stats()
