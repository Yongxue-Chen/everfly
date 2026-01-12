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
        valid_data = {k: v for k, v in data.items() if k in columns}

        # Special logic for flights duration
        if table_name == 'flights':
            conn = database.get_db()
            try:
                origin_id = valid_data.get('origin_airport_id')
                dest_id = valid_data.get('dest_airport_id')
                if origin_id and dest_id:
                    if valid_data.get('std') and valid_data.get('sta') and not valid_data.get('duration_scheduled'):
                        valid_data['duration_scheduled'] = calculate_duration(conn, origin_id, dest_id, valid_data['std'], valid_data['sta'])
                    if valid_data.get('atd') and valid_data.get('ata') and not valid_data.get('duration_actual'):
                        valid_data['duration_actual'] = calculate_duration(conn, origin_id, dest_id, valid_data['atd'], valid_data['ata'])
            finally:
                conn.close()

        if not valid_data:
             return jsonify({'error': 'No valid data provided'}), 400
        
        cols = ', '.join(valid_data.keys())
        placeholders = ', '.join(['?'] * len(valid_data))
        values = list(valid_data.values())
        
        try:
            new_id = execute_db(f"INSERT INTO {table_name} ({cols}) VALUES ({placeholders})", values)
            new_item = query_db(f"SELECT * FROM {table_name} WHERE id = ?", (new_id,), one=True)
            return jsonify(new_item), 201
        except Exception as e:
            return jsonify({'error': str(e)}), 500

    # PUT update
    @app.route(f'/api/{endpoint}/<int:id>', methods=['PUT'], endpoint=f'update_{endpoint}')
    def update_item(id):
        data = request.json
        valid_data = {k: v for k, v in data.items() if k in columns}

        # Special logic for flights duration
        if table_name == 'flights':
            conn = database.get_db()
            try:
                # Fetch existing to compare or fill
                cur = conn.execute("SELECT origin_airport_id, dest_airport_id, std, sta, atd, ata FROM flights WHERE id = ?", (id,))
                row = cur.fetchone()
                if row:
                    merged = {
                        'origin_airport_id': valid_data.get('origin_airport_id', row[0]),
                        'dest_airport_id': valid_data.get('dest_airport_id', row[1]),
                        'std': valid_data.get('std', row[2]),
                        'sta': valid_data.get('sta', row[3]),
                        'atd': valid_data.get('atd', row[4]),
                        'ata': valid_data.get('ata', row[5])
                    }
                    if merged['std'] and merged['sta'] and not valid_data.get('duration_scheduled'):
                        valid_data['duration_scheduled'] = calculate_duration(conn, merged['origin_airport_id'], merged['dest_airport_id'], merged['std'], merged['sta'])
                    if merged['atd'] and merged['ata'] and not valid_data.get('duration_actual'):
                        valid_data['duration_actual'] = calculate_duration(conn, merged['origin_airport_id'], merged['dest_airport_id'], merged['atd'], merged['ata'])
            finally:
                conn.close()

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
cities_cols = ['name', 'country', 'country_code', 'timezone']
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
        
        # Cities
        cur = conn.execute("PRAGMA table_info(cities)")
        cities_cols_db = [row[1] for row in cur.fetchall()]
        if 'country_code' not in cities_cols_db:
             conn.execute("ALTER TABLE cities ADD COLUMN country_code TEXT")

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
import os
import io
import csv
from datetime import datetime
import pytz
import airlines_data

def calculate_duration(conn, origin_id, dest_id, dep_str, arr_str):
    """Calculate duration in minutes considering timezones."""
    if not dep_str or not arr_str: return None
    try:
        # Get Timezones
        def get_tz(aid):
            cur = conn.execute('''
                SELECT c.timezone FROM airports a 
                JOIN cities c ON a.city_id = c.id 
                WHERE a.id = ?
            ''', (aid,))
            row = cur.fetchone()
            return row[0] if row else 'UTC'
        
        origin_tz_name = get_tz(origin_id)
        dest_tz_name = get_tz(dest_id)
        
        # Parse Dates (Try with/without T)
        def parse_dt(dt_str, tz_name):
            dt_str = dt_str.replace('T', ' ')
            # Fallback formats
            fmts = ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M"]
            for fmt in fmts:
                try:
                    dt = datetime.strptime(dt_str, fmt)
                    tz = pytz.timezone(tz_name)
                    return tz.localize(dt)
                except:
                    pass
            return None

        dep_dt = parse_dt(dep_str, origin_tz_name)
        arr_dt = parse_dt(arr_str, dest_tz_name)
        
        if dep_dt and arr_dt:
            diff = arr_dt - dep_dt
            return int(diff.total_seconds() / 60)
    except Exception as e:
        print(f"Duration calc error: {e}")
    return None

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
                'country_code': ['code', 'country_code', 'iso_code'],
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
                'std': ['std', 'dep_time_scheduled', 'dep_time', 'scheduled_dep', 'departure'],
                'atd': ['atd', 'dep_time_actual', 'actual_dep'],
                'sta': ['sta', 'arr_time_scheduled', 'arr_time', 'scheduled_arr', 'arrival'],
                'ata': ['ata', 'arr_time_actual', 'actual_arr'],
                'seat_number': ['seat', 'seat_no'],
                'flight_class': ['class', 'cabin'],
                'seat_type': ['seat_type', 'window/aisle'],
                'note': ['note', 'notes', 'comment'],
                'origin_terminal': ['origin_terminal', 'from_terminal', 'dep_terminal'],
                'dest_terminal': ['dest_terminal', 'to_terminal', 'arr_terminal'],
                'registration': ['registration', 'reg', 'tail_number', 'aircraft_registration'],
                'distance': ['distance', 'dist', 'mileage'],
                'duration_scheduled': ['duration_scheduled', 'sched_duration', 'flight_time_scheduled'],
                'duration_actual': ['duration_actual', 'actual_duration', 'flight_time_actual'],
                'tag_generation': ['tag_generation', 'selected_gen', 'generation'],
                'tag_winglets': ['tag_winglets', 'selected_winglets', 'winglets'],
                'tag_config': ['tag_config', 'selected_config', 'config']
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
                # Smart Fetch from IATA
                iata = normalized_row.get('iata_code')
                if iata and len(iata) == 3:
                    # If name or lat/lon missing, try to fetch from airportsdata
                    if not normalized_row.get('name') or not normalized_row.get('lat') or not normalized_row.get('icao_code'):
                        ad_data = airportsdata.load('IATA')
                        info = ad_data.get(iata.upper())
                        if info:
                            if not normalized_row.get('name'): normalized_row['name'] = info.get('name')
                            if not normalized_row.get('icao_code'): normalized_row['icao_code'] = info.get('icao')
                            if not normalized_row.get('lat'): normalized_row['lat'] = info.get('lat')
                            if not normalized_row.get('lon'): normalized_row['lon'] = info.get('lon')
                            # City logic: if city_id missing, use info.get('city') etc
                            if 'city_id' not in normalized_row:
                                city_name = info.get('city')
                                country_code = info.get('country')
                                if city_name:
                                    # Reuse logic from _update_airport_logic if possible, or just look up
                                    cur_c = conn.execute("SELECT id FROM cities WHERE name = ? AND country_code = ?", (city_name, country_code))
                                    res_c = cur_c.fetchone()
                                    if res_c: normalized_row['city_id'] = res_c[0]
                                    else:
                                        # Create basic city
                                        conn.execute("INSERT INTO cities (name, country, country_code, timezone) VALUES (?, ?, ?, ?)",
                                                   (city_name, country_code, country_code, info.get('tz')))
                                        normalized_row['city_id'] = conn.execute("SELECT last_insert_rowid()").fetchone()[0]

                # Manual Autolink City (Fallback if not fetched above)
                if 'city_id' not in normalized_row:
                    cname = normalized_row.get('city') or normalized_row.get('city_name')
                    if cname:
                        cid = lookup_id('cities', 'name', cname)
                        if cid: normalized_row['city_id'] = cid
                        else: errors.append(f"Row {i+1}: City '{cname}' not found.")
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
                        # Try IATA then ICAO then Name
                        aid = lookup_id('airlines', 'iata_code', val) or \
                              lookup_id('airlines', 'icao_code', val) or \
                              lookup_id('airlines', 'name', val)
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
                
                # Auto-Calculate Durations & TZ Conversion
                std = normalized_row.get('std')
                sta = normalized_row.get('sta')
                atd = normalized_row.get('atd')
                ata = normalized_row.get('ata')
                origin_id = normalized_row.get('origin_airport_id')
                dest_id = normalized_row.get('dest_airport_id')

                # Helper to convert to Airport Local Time if TZ info is present
                def convert_to_local(dt_str, airport_id):
                    if not dt_str or not airport_id: return dt_str
                    try:
                         # 1. Parse string to datetime (dateutil is best but using basic first)
                        dt = None
                        # Trying flexible parsing with dateutil if available, else basic
                        from dateutil import parser
                        dt = parser.parse(dt_str)
                        
                        # 2. If naive, assume it's already local, return formatted
                        if dt.tzinfo is None:
                            return dt.strftime('%Y-%m-%d %H:%M')
                        
                        # 3. If aware, find airport timezone
                        # Need efficient lookup. Cache? Doing per-row for now as volume is low.
                        cur_tz = conn.execute('''
                            SELECT c.timezone FROM airports a 
                            JOIN cities c ON a.city_id = c.id 
                            WHERE a.id = ?
                        ''', (airport_id,))
                        row_tz = cur_tz.fetchone()
                        if row_tz and row_tz[0]:
                            target_tz = pytz.timezone(row_tz[0])
                            dt_local = dt.astimezone(target_tz)
                            return dt_local.strftime('%Y-%m-%d %H:%M') # Return naive string
                        else:
                            # No airport TZ found, fallback to UTC or keep as is? 
                            # If we can't convert, keeping original might be safer or strip tz
                            return dt.replace(tzinfo=None).strftime('%Y-%m-%d %H:%M')
                    except Exception as e:
                        print(f"Time parse error: {e}")
                        return dt_str # Return original on failure

                # Convert input times to correct local times if they have TZ info
                if origin_id:
                    if std: normalized_row['std'] = convert_to_local(std, origin_id)
                    if atd: normalized_row['atd'] = convert_to_local(atd, origin_id)
                if dest_id:
                    if sta: normalized_row['sta'] = convert_to_local(sta, dest_id)
                    if ata: normalized_row['ata'] = convert_to_local(ata, dest_id)
                
                # Fetch new values after conversion for duration calc
                std = normalized_row.get('std')
                sta = normalized_row.get('sta')
                atd = normalized_row.get('atd')
                ata = normalized_row.get('ata')

                # Auto-fill Date if missing
                if 'date' not in normalized_row or not normalized_row['date']:
                    # Try to get date from STD, then ATD
                    ref_time = std if std else atd
                    if ref_time:
                         try:
                             # format is YYYY-MM-DD HH:MM
                             normalized_row['date'] = ref_time.split(' ')[0]
                         except:
                             pass

                if origin_id and dest_id:
                    if std and sta and not normalized_row.get('duration_scheduled'):
                        normalized_row['duration_scheduled'] = calculate_duration(conn, origin_id, dest_id, std, sta)
                    if atd and ata and not normalized_row.get('duration_actual'):
                        normalized_row['duration_actual'] = calculate_duration(conn, origin_id, dest_id, atd, ata)

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
               oa.iata_code as origin_code, oa.name as origin_name, oa.lat as origin_lat, oa.lon as origin_lon,
               oc.timezone as origin_tz,
               da.iata_code as dest_code, da.name as dest_name, da.lat as dest_lat, da.lon as dest_lon,
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

# --- Automation Logic ---
import airportsdata
import pycountry

def _update_airport_logic(id, conn):
    """Helper to update single airport."""
    updated_fields = []
    # Use row_factory or index carefully. Schema: id=0, name=1, iata=2, icao=3, city_id=4, lat=5, lon=6
    cur = conn.execute("SELECT * FROM airports WHERE id = ?", (id,))
    row = cur.fetchone()
    if not row: return False, "Not found"
    
    iata = row[2] 
    if not iata or len(iata) != 3: return False, "Invalid IATA"

    airports = airportsdata.load('IATA')
    data = airports.get(iata)
    if not data: return False, "No data found for IATA"

    # 1. Update ICAO, Lat, Lon
    new_icao = data.get('icao', '')
    new_lat = data.get('lat')
    new_lon = data.get('lon')
    
    conn.execute("UPDATE airports SET icao_code = ?, lat = ?, lon = ? WHERE id = ?", 
                    (new_icao, new_lat, new_lon, id))
    updated_fields.extend(['icao_code', 'lat', 'lon'])

    # 2. Match City
    current_city_id = row[4]
    
    # We update city if missing
    if not current_city_id:
        city_name = data.get('city')
        country_code = data.get('country') 
        tz = data.get('tz')

        # Find City Logic: Strict Match (Name + Code)
        cur = conn.execute("SELECT id FROM cities WHERE name = ? AND country_code = ?", (city_name, country_code))
        res = cur.fetchone()
        
        city_id = None
        if res:
            city_id = res[0]
        else:
            # Fallback: Check Legacy (Name match, Code Null) -> Update it
            cur = conn.execute("SELECT id, country_code FROM cities WHERE name = ?", (city_name,))
            matches = cur.fetchall()
            if len(matches) == 1 and not matches[0][1]:
                # Legacy Update
                city_id = matches[0][0]
                conn.execute("UPDATE cities SET country_code = ?, timezone = ? WHERE id = ?", (country_code, tz, city_id))
            else:
                # Create New
                conn.execute("INSERT INTO cities (name, country, country_code, timezone) VALUES (?, ?, ?, ?)",
                            (city_name, country_code, country_code, tz))
                city_id = cur.lastrowid
        
        conn.execute("UPDATE airports SET city_id = ? WHERE id = ?", (city_id, id))
        updated_fields.append('city_id')
    
    return True, updated_fields

# --- API Routes for Automation ---
@app.route('/api/airports/<int:id>/update', methods=['POST'])
def update_airport(id):
    try:
        conn = database.get_db()
        success, res = _update_airport_logic(id, conn)
        conn.commit()
        conn.close()
        if success: return jsonify({'message': 'Updated', 'fields': res})
        else: return jsonify({'error': res}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/airports/batch_update', methods=['POST'])
def batch_update_airports():
    try:
        conn = database.get_db()
        cur = conn.execute("SELECT id FROM airports WHERE (icao_code IS NULL OR icao_code = '') OR city_id IS NULL")
        ids = [row[0] for row in cur.fetchall()]
        
        count = 0
        for aid in ids:
            success, _ = _update_airport_logic(aid, conn)
            if success: count += 1
            
        conn.commit()
        conn.close()
        return jsonify({'message': f'Processed {len(ids)} airports, Updated {count}.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def _update_airline_logic(id, conn):
    """Helper to update single airline IATA from ICAO if possible."""
    cur = conn.execute("SELECT icao_code, iata_code FROM airlines WHERE id = ?", (id,))
    row = cur.fetchone()
    if not row or not row[0]: return False, "No ICAO code"
    icao = row[0].upper()
    
    idata = airlines_data.AIRLINES_ICAO_TO_IATA.get(icao)
    if idata:
        conn.execute("UPDATE airlines SET iata_code = ? WHERE id = ?", (idata, id))
        return True, "Updated"
    
    return False, "ICAO code not found in database"

@app.route('/api/airlines/<int:id>/update', methods=['POST'])
def update_airline(id):
    try:
        conn = database.get_db()
        success, res = _update_airline_logic(id, conn)
        conn.commit()
        conn.close()
        if success: return jsonify({'message': 'Updated'})
        else: return jsonify({'error': res}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/airlines/batch_update', methods=['POST'])
def batch_update_airlines():
    try:
        conn = database.get_db()
        # Select ALL airlines with an ICAO code to allow correcting wrong IATA codes
        cur = conn.execute("SELECT id FROM airlines WHERE icao_code IS NOT NULL AND icao_code != ''")
        ids = [row[0] for row in cur.fetchall()]
        
        count = 0
        for aid in ids:
            # logic already does a lookup and update if found
            success, _ = _update_airline_logic(aid, conn)
            if success: count += 1
            
        conn.commit()
        conn.close()
        return jsonify({'message': f'Processed {len(ids)} airlines, Updated {count}.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cities/<int:id>/update', methods=['POST'])
def update_city(id):
    try:
        conn = database.get_db()
        cur = conn.execute("SELECT name, country FROM cities WHERE id = ?", (id,))
        row = cur.fetchone()
        if not row: return jsonify({'error': 'City not found'}), 404
        
        city_name, country_name = row
        if not country_name: return jsonify({'error': 'Country name missing'}), 400

        try:
            countries = pycountry.countries.search_fuzzy(country_name)
            if countries:
                code = countries[0].alpha_2
                conn.execute("UPDATE cities SET country_code = ? WHERE id = ?", (code, id))
                conn.commit()
                conn.close()
                return jsonify({'message': 'Updated', 'code': code})
            else:
                 conn.close()
                 return jsonify({'error': 'Country not found'}), 404
        except LookupError:
             conn.close()
             return jsonify({'error': 'Lookup failed'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/cities/batch_update', methods=['POST'])
def batch_update_cities():
    try:
        conn = database.get_db()
        cur = conn.execute("SELECT id, country FROM cities WHERE country_code IS NULL OR country_code = ''")
        rows = cur.fetchall()
        
        count = 0
        for id, country_name in rows:
            if not country_name: continue
            try:
                countries = pycountry.countries.search_fuzzy(country_name)
                if countries:
                    code = countries[0].alpha_2
                    conn.execute("UPDATE cities SET country_code = ? WHERE id = ?", (code, id))
                    count += 1
            except:
                continue
                
        conn.commit()
        conn.close()
        return jsonify({'message': f'Updated {count} cities.'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Initialize DB (safe to run multiple times)
    database.init_db()
    app.run(debug=True, port=5000)
