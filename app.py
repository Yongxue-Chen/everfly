from flask import Flask, render_template, jsonify, request
import os
import database
import sqlite3

app = Flask(__name__)

# Ensure the instance folder exists
try:
    os.makedirs(app.instance_path)
except OSError:
    pass

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/health')
def health():
    return jsonify({"status": "ok"})

# --- Helper Functions ---
def query_db(query, args=(), one=False):
    conn = database.get_db()
    cur = conn.execute(query, args)
    rv = [dict(row) for row in cur.fetchall()]
    conn.close()
    return (rv[0] if rv else None) if one else rv

def execute_db(query, args=()):
    conn = database.get_db()
    try:
        cur = conn.execute(query, args)
        conn.commit()
        lastrowid = cur.lastrowid
        conn.close()
        return lastrowid
    except Exception as e:
        conn.rollback()
        conn.close()
        raise e

# --- CRUD Routes Generation Helper ---
def create_crud_routes(endpoint, table_name, columns):
    # GET all
    @app.route(f'/api/{endpoint}', methods=['GET'], endpoint=f'get_{endpoint}')
    def get_all():
        rows = query_db(f"SELECT * FROM {table_name}")
        return jsonify(rows)

    # POST create
    @app.route(f'/api/{endpoint}', methods=['POST'], endpoint=f'create_{endpoint}')
    def create_item():
        data = request.json
        # Filter data to only include valid columns
        valid_data = {k: v for k, v in data.items() if k in columns}
        if not valid_data:
             return jsonify({'error': 'No valid data provided'}), 400
        
        cols = ', '.join(valid_data.keys())
        placeholders = ', '.join(['?'] * len(valid_data))
        values = list(valid_data.values())
        
        try:
            new_id = execute_db(f"INSERT INTO {table_name} ({cols}) VALUES ({placeholders})", values)
            # return the new item
            new_item = query_db(f"SELECT * FROM {table_name} WHERE id = ?", (new_id,), one=True)
            return jsonify(new_item), 201
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    # PUT update
    @app.route(f'/api/{endpoint}/<int:id>', methods=['PUT'], endpoint=f'update_{endpoint}')
    def update_item(id):
        data = request.json
        valid_data = {k: v for k, v in data.items() if k in columns}
        if not valid_data:
            return jsonify({'error': 'No valid data provided'}), 400

        set_clause = ', '.join([f"{k} = ?" for k in valid_data.keys()])
        values = list(valid_data.values())
        values.append(id)
        
        try:
            execute_db(f"UPDATE {table_name} SET {set_clause} WHERE id = ?", values)
            updated_item = query_db(f"SELECT * FROM {table_name} WHERE id = ?", (id,), one=True)
            return jsonify(updated_item)
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    # DELETE
    @app.route(f'/api/{endpoint}/<int:id>', methods=['DELETE'], endpoint=f'delete_{endpoint}')
    def delete_item(id):
        try:
            execute_db(f"DELETE FROM {table_name} WHERE id = ?", (id,))
            return jsonify({'message': 'Deleted', 'id': id})
        except Exception as e:
            return jsonify({'error': str(e)}), 500

# --- Define Entities ---
# Schema columns for validation (excluding id)
# Schema columns for validation (excluding id)
cities_cols = ['name', 'country', 'timezone']
airports_cols = ['name', 'iata_code', 'icao_code', 'city_id', 'lat', 'lon', 'terminals']
airlines_cols = ['name', 'iata_code', 'icao_code', 'frequent_flyer_program', 'frequent_flyer_id']
aircraft_cols = ['name', 'manufacturer', 'model', 'series', 'subtype', 'generation', 'engine_type', 'winglets',
                 'tags_generation', 'tags_winglets', 'tags_config']
flights_cols = ['date', 'flight_number', 'airline_id', 'aircraft_model_id', 'origin_airport_id', 'dest_airport_id',
                'dep_time_scheduled', 'arr_time_scheduled', 'seat_number', 'seat_type', 'flight_class', 'note',
                'origin_terminal', 'dest_terminal', 'tag_generation', 'tag_winglets', 'tag_config',
                'registration', 'distance', 'duration_scheduled', 'duration_actual',
                'std', 'atd', 'sta', 'ata']

# --- Auto-Migration Helper ---
def migrate_schema():
    """Ensure database has new columns without losing data."""
    try:
        conn = database.get_db()
        
        # Airlines
        cur = conn.execute("PRAGMA table_info(airlines)")
        airlines_cols_db = [row[1] for row in cur.fetchall()]
        if 'icao_code' not in airlines_cols_db:
            conn.execute("ALTER TABLE airlines ADD COLUMN icao_code TEXT")
        if 'frequent_flyer_id' not in airlines_cols_db:
            conn.execute("ALTER TABLE airlines ADD COLUMN frequent_flyer_id TEXT")
            
        # Airports
        cur = conn.execute("PRAGMA table_info(airports)")
        airports_cols_db = [row[1] for row in cur.fetchall()]
        if 'terminals' not in airports_cols_db:
            conn.execute("ALTER TABLE airports ADD COLUMN terminals TEXT")

        # Aircraft Models
        cur = conn.execute("PRAGMA table_info(aircraft_models)")
        aircraft_cols_db = [row[1] for row in cur.fetchall()]
        if 'tags_generation' not in aircraft_cols_db:
             conn.execute("ALTER TABLE aircraft_models ADD COLUMN tags_generation TEXT")
             conn.execute("ALTER TABLE aircraft_models ADD COLUMN tags_engine TEXT")
             conn.execute("ALTER TABLE aircraft_models ADD COLUMN tags_winglets TEXT")
        
        if 'tags_config' not in aircraft_cols_db:
             conn.execute("ALTER TABLE aircraft_models ADD COLUMN tags_config TEXT")
             
        if 'name' not in aircraft_cols_db:
             conn.execute("ALTER TABLE aircraft_models ADD COLUMN name TEXT")
             # Populate existing names: Model-Subtype if exists, else Model-Series
             # We use a simple SQL update for this
             conn.execute("""
                UPDATE aircraft_models 
                SET name = model || '-' || CASE WHEN subtype IS NOT NULL AND subtype != '' THEN subtype ELSE series END
             """)
             print("Migrated: added and populated name to aircraft_models")

        # Flights
        cur = conn.execute("PRAGMA table_info(flights)")
        flights_cols_db = [row[1] for row in cur.fetchall()]
        if 'origin_terminal' not in flights_cols_db:
            conn.execute("ALTER TABLE flights ADD COLUMN origin_terminal TEXT")
            conn.execute("ALTER TABLE flights ADD COLUMN dest_terminal TEXT")
        
        if 'tag_generation' not in flights_cols_db:
            conn.execute("ALTER TABLE flights ADD COLUMN tag_generation TEXT")
            conn.execute("ALTER TABLE flights ADD COLUMN tag_winglets TEXT")
            
        if 'tag_config' not in flights_cols_db:
            conn.execute("ALTER TABLE flights ADD COLUMN tag_config TEXT")

        # New Flight Columns
        if 'registration' not in flights_cols_db:
            conn.execute("ALTER TABLE flights ADD COLUMN registration TEXT")
            conn.execute("ALTER TABLE flights ADD COLUMN distance INTEGER")
            conn.execute("ALTER TABLE flights ADD COLUMN duration_scheduled INTEGER")
            conn.execute("ALTER TABLE flights ADD COLUMN duration_actual INTEGER")
            conn.execute("ALTER TABLE flights ADD COLUMN std TEXT")
            conn.execute("ALTER TABLE flights ADD COLUMN atd TEXT")
            conn.execute("ALTER TABLE flights ADD COLUMN sta TEXT")
            conn.execute("ALTER TABLE flights ADD COLUMN ata TEXT")
            print("Migrated: added extended flight details")

        conn.commit()

        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Migration warning: {e}")

# Run migration on start
with app.app_context():
    migrate_schema()

create_crud_routes('cities', 'cities', cities_cols)
create_crud_routes('airports', 'airports', airports_cols)
create_crud_routes('airlines', 'airlines', airlines_cols)
create_crud_routes('aircraft_models', 'aircraft_models', aircraft_cols)
create_crud_routes('flights', 'flights', flights_cols)


# --- CSV Import Route ---
import csv
import io

@app.route('/api/import/<table_name>', methods=['POST'])
def import_csv(table_name):
    # Security check for allowed tables
    ALLOWED_TABLES = ['cities', 'airports', 'airlines', 'aircraft_models', 'flights']
    if table_name not in ALLOWED_TABLES:
        return jsonify({'error': 'Invalid table name'}), 400

    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    try:
        # Read raw bytes
        file_bytes = file.stream.read()
        text_content = ""
        
        # Try decoding with UTF-8 first (including BOM for Excel CSVs)
        try:
            text_content = file_bytes.decode('utf-8-sig')
        except UnicodeDecodeError:
            # Fallback to GB18030 (covers GBK and GB2312) which is common in Chinese Windows
            try:
                text_content = file_bytes.decode('gb18030')
            except UnicodeDecodeError:
                 return jsonify({'error': 'Could not decode file. Please save as UTF-8 or GBK.'}), 400

        stream = io.StringIO(text_content, newline=None)
        csv_input = csv.DictReader(stream)
        
        target_cols = []
        if table_name == 'cities': target_cols = cities_cols
        elif table_name == 'airports': target_cols = airports_cols
        elif table_name == 'airlines': target_cols = airlines_cols
        elif table_name == 'aircraft_models': target_cols = aircraft_cols
        elif table_name == 'flights': target_cols = flights_cols
        
        success_count = 0
        errors = []

        conn = database.get_db()
        
        # Helper for lookups
        def lookup_id(table, col, val):
            cur = conn.execute(f"SELECT id FROM {table} WHERE {col} = ?", (val,))
            res = cur.fetchone()
            return res[0] if res else None

        # Column Mapping Helpers
        def normalize_key(k):
            return k.strip().lower().replace(' ', '_')

        # Define Aliases per Table to avoid collisions
        # e.g. 'city' means 'name' in Cities table, but 'city_name' in Airports table
        TABLE_ALIASES = {
            'cities': {
                'name': ['name', 'city', 'city_name'],
                'country': ['country', 'nation'],
                'timezone': ['timezone', 'tz']
            },
            'airports': {
                'name': ['name', 'airport', 'airport_name'],
                'iata_code': ['iata', 'code', 'iata_code'],
                'icao_code': ['icao', 'icao_code'],
                'city_name': ['city', 'city_name'], # Lookup target
                'city_id': ['city_id'],
                'lat': ['lat', 'latitude'],
                'lon': ['lon', 'long', 'longitude'],
                'terminals': ['terminals', 'terminal_list']
            },
            'airlines': {
                'name': ['name', 'airline', 'airline_name'],
                'iata_code': ['iata', 'code', 'iata_code'],
                'icao_code': ['icao', 'icao_code'],
                'frequent_flyer_program': ['ff', 'program', 'frequent_flyer', 'ff_program'],
                'frequent_flyer_id': ['ff_id', 'member_id', 'card_number']
            },
            'aircraft_models': {
                'manufacturer': ['manufacturer', 'make'],
                'model': ['model', 'type', 'aircraft'],
                'series': ['series'],
                'subtype': ['subtype'],
                'generation': ['generation'],
                'engine_type': ['engine'],
                'winglets': ['winglets'],
                'tags_generation': ['tags_generation', 'generation_options', 'gen_ops'],
                'tags_winglets': ['tags_winglets', 'winglet_options', 'wl_ops'],
                'tags_config': ['tags_config', 'config_options', 'conf_ops']
            },
            'flights': {
                'date': ['date', 'day'],
                'flight_number': ['flight', 'flight_number', 'flight_no', 'number'],
                'origin_code': ['origin', 'from', 'origin_code', 'dep'],
                'dest_code': ['destination', 'to', 'dest_code', 'arr'],
                'airline_val': ['airline', 'airline_name', 'carrier'], # Lookup
                'aircraft_val': ['aircraft', 'type', 'aircraft_model', 'equipment'], # Lookup
                'dep_time_scheduled': ['std', 'dep_time', 'scheduled_dep', 'departure'],
                'arr_time_scheduled': ['sta', 'arr_time', 'scheduled_arr', 'arrival'],
                'seat_number': ['seat', 'seat_no'],
                'flight_class': ['class', 'cabin'],
                'seat_type': ['seat_type', 'window/aisle'],
                'note': ['note', 'notes', 'comment'],
                'origin_terminal': ['origin_terminal', 'from_terminal', 'dep_terminal'],
                'dest_terminal': ['dest_terminal', 'to_terminal', 'arr_terminal'],
                'tag_generation': ['tag_generation', 'selected_gen'],
                'tag_winglets': ['tag_winglets', 'selected_winglets'],
                'tag_config': ['tag_config', 'selected_config']
            }
        }
        
        # Get specific aliases for this table (fallback to empty dict if not defined, though they strictly are)
        current_aliases = TABLE_ALIASES.get(table_name, {})

        for i, row in enumerate(csv_input):
            # 1. Normalize Row Keys
            normalized_row = {}
            for k, v in row.items():
                norm_k = normalize_key(k)
                mapped_key = norm_k # default
                
                # Check against specific table aliases
                for db_col, aliases in current_aliases.items():
                   if norm_k in aliases:
                       mapped_key = db_col
                       break
                
                normalized_row[mapped_key] = v.strip()

            # 2. Auto-Linking Logic
            # Lookup Helpers
            if table_name == 'airports':
                if 'city_id' not in normalized_row or not normalized_row['city_id']:
                    cname = normalized_row.get('city_name')
                    if cname:
                        cid = lookup_id('cities', 'name', cname)
                        if cid: normalized_row['city_id'] = cid
                        else: errors.append(f"Row {i+1}: City '{cname}' not found.") # Non-blocking for now? No, required.
                        # Note: if city_id is required by DB, insert will fail later if we don't handle it.
                        if not cid: continue 

            if table_name == 'aircraft_models':
                if 'name' not in normalized_row or not normalized_row['name']:
                    # Auto-generate name: Model-Subtype (if exists) else Model-Series
                    model = normalized_row.get('model', '')
                    series = normalized_row.get('series', '')
                    subtype = normalized_row.get('subtype', '')
                    
                    if subtype:
                        normalized_row['name'] = f"{model}-{subtype}"
                    else:
                        normalized_row['name'] = f"{model}-{series}"

            if table_name == 'flights':
                # Origin
                if 'origin_airport_id' not in normalized_row:
                    code = normalized_row.get('origin_code') or normalized_row.get('iata_code') # fallback
                    if code:
                        aid = lookup_id('airports', 'iata_code', code)
                        if aid: normalized_row['origin_airport_id'] = aid
                        else: errors.append(f"Row {i+1}: Origin '{code}' not found."); continue

                # Dest
                if 'dest_airport_id' not in normalized_row:
                    code = normalized_row.get('dest_code')
                    if code:
                        aid = lookup_id('airports', 'iata_code', code)
                        if aid: normalized_row['dest_airport_id'] = aid
                        else: errors.append(f"Row {i+1}: Dest '{code}' not found."); continue

                # Airline
                if 'airline_id' not in normalized_row:
                    val = normalized_row.get('airline_val')
                    if val:
                        # Try IATA then Name
                        aid = lookup_id('airlines', 'iata_code', val) or lookup_id('airlines', 'name', val)
                        if aid: normalized_row['airline_id'] = aid
                        else: errors.append(f"Row {i+1}: Airline '{val}' not found."); continue

                # Aircraft
                if 'aircraft_model_id' not in normalized_row:
                    val = normalized_row.get('aircraft_val')
                    if val:
                        # Try Exact Name Match (Preferred), then Model
                        aid = lookup_id('aircraft_models', 'name', val)
                        if not aid:
                            aid = lookup_id('aircraft_models', 'model', val)
                        
                        if aid: normalized_row['aircraft_model_id'] = aid
                        else: errors.append(f"Row {i+1}: Aircraft '{val}' not found."); continue

            # 3. Prepare Final Data
            valid_data = {k: v for k, v in normalized_row.items() if k in target_cols}
            
            if not valid_data:
                continue

            cols = ', '.join(valid_data.keys())
            placeholders = ', '.join(['?'] * len(valid_data))
            values = list(valid_data.values())

            try:
                conn.execute(f"INSERT INTO {table_name} ({cols}) VALUES ({placeholders})", values)
                success_count += 1
            except Exception as e:
                errors.append(f"Row {i+1}: {str(e)}")
        
        conn.commit()
        conn.close()
        
        return jsonify({'message': f'Imported {success_count} rows', 'errors': errors})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/clear/<table_name>', methods=['DELETE'])
def clear_table(table_name):
    ALLOWED_TABLES = ['cities', 'airports', 'airlines', 'aircraft_models', 'flights']
    if table_name not in ALLOWED_TABLES:
        return jsonify({'error': 'Invalid table name'}), 400
    
    try:
        conn = database.get_db()
        conn.execute(f"DELETE FROM {table_name}")
        # Reset Auto Increment? Optional but cleaner
        conn.execute(f"DELETE FROM sqlite_sequence WHERE name='{table_name}'")
        conn.commit()
        conn.close()
        return jsonify({'message': f'{table_name} cleared'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# --- Special Route for Stats/Map Data if needed ---
@app.route('/api/flights/detailed', methods=['GET'])
def get_flights_detailed():
    conn = database.get_db()
    cursor = conn.execute('''
        SELECT f.*, 
               oa.iata_code as origin_code, oa.lat as origin_lat, oa.lon as origin_lon,
               oc.timezone as origin_tz,
               da.iata_code as dest_code, da.lat as dest_lat, da.lon as dest_lon,
               dc.timezone as dest_tz,
               al.name as airline_name,
               am.name as aircraft_model
        FROM flights f
        JOIN airports oa ON f.origin_airport_id = oa.id
        JOIN cities oc ON oa.city_id = oc.id
        JOIN airports da ON f.dest_airport_id = da.id
        JOIN cities dc ON da.city_id = dc.id
        JOIN airlines al ON f.airline_id = al.id
        JOIN aircraft_models am ON f.aircraft_model_id = am.id
        ORDER BY f.date DESC
    ''')
    rows = cursor.fetchall()
    
    flights = []
    # Convert row to dict manually or use row_factory
    col_names = [description[0] for description in cursor.description]
    for row in rows:
        flights.append(dict(zip(col_names, row)))
        
    conn.close()
    return jsonify(flights)

if __name__ == '__main__':
    # Initialize DB (safe to run multiple times)
    database.init_db()
    app.run(debug=True, port=5000)
