import sqlite3

DATABASE = 'flightlog.db'

def update_continents():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Get all cities with timezone but no continent
    cursor.execute("SELECT id, timezone FROM cities WHERE (continent IS NULL OR continent = '') AND timezone IS NOT NULL AND timezone != ''")
    cities = cursor.fetchall()
    
    updated_count = 0
    for city_id, tz in cities:
        if '/' in tz:
            continent = tz.split('/')[0]
            # Normalize some known cases if needed, but usually timezone continent is fine
            # e.g., America/New_York -> America (Matches North/South America? User might want strict continents)
            # Standard Timezone continents: Africa, America, Antarctica, Arctic, Asia, Atlantic, Australia, Europe, Indian, Pacific
            
            # Map 'America' to 'North America' or 'South America' is hard without country code.
            # But the user asked to extract from "/", so we'll stick to that for now.
            # Or better, we can map common ones.
            
            cursor.execute("UPDATE cities SET continent = ? WHERE id = ?", (continent, city_id))
            updated_count += 1
            
    conn.commit()
    conn.close()
    print(f"Updated {updated_count} cities with continent info derived from timezone.")

if __name__ == '__main__':
    update_continents()
