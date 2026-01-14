from flask import Flask, render_template, jsonify, request, g, session, redirect, url_for, flash
import os
import database
import sqlite3
import requests
import dateutil.parser
import airportsdata
from datetime import datetime, timedelta
import pytz
import json
import werkzeug.security

app = Flask(__name__)
app.secret_key = 'dev_secret_key' # In prod this should be secure random
FLIGHTAWARE_API_KEY = 'REMOVED-REVOKED-API-KEY'

# --- Auth Middleware ---
@app.before_request
def load_logged_in_user():
    user_id = session.get('user_id')
    if user_id is None:
        g.user = None
    else:
        conn = database.get_users_db()
        g.user = conn.execute('SELECT * FROM users WHERE id = ?', (user_id,)).fetchone()
        conn.close()
        
    if g.user:
        # FIX for cross-platform migration:
        # DB might contain Windows path "C:\...\file.db" but we are on Linux.
        # So we extract just the filename and prepend the current instance path.
        stored_path = g.user['db_filename']
        # Normalized handling: Replace backslash with forward slash and take the last part.
        # This handles Windows paths (C:\...) even when running on Linux.
        filename = stored_path.replace('\\', '/').split('/')[-1]
        g.db_path = os.path.join(app.instance_path, filename)
        if g.db_path: # Ensure we have a path
             # Check if DB initialized
             if not os.path.exists(g.db_path) or os.path.getsize(g.db_path) == 0:
                 print(f"User DB missing/empty, initializing: {g.db_path}")
                 database.init_db(target_db_path=g.db_path)
             else:
                 # Check table existence (handle case where file exists but is empty/corrupt)
                 try:
                     conn = sqlite3.connect(g.db_path)
                     cur = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='flights'")
                     if not cur.fetchone():
                         print(f"User DB uninitialized, initializing: {g.db_path}")
                         # init_db handles connection internally
                         conn.close() 
                         database.init_db(target_db_path=g.db_path)
                     else:
                        conn.close()
                        # Run migration for existing users
                        # But be careful not to cycle? migrate_schema uses get_db() -> g.db, 
                        # so we need to ensure g.db points to g.db_path. 
                        # get_db() uses g.db_path, so it's safe.
                        # We need to make sure this doesn't slow down every request.
                        # For now, let's just run it. It checks schema so should be fast.
                        pass # Actually calling migrate_schema here might be heavy for EVERY request.
                        # Ideally only on login or once per session?
                        # Or just rely on admin endpoint?
                        # User asked why flightlog.db is created, which was due to global call.
                        # If we remove global call, user DBs might get outdated schema.
                        # Let's add a check: Is this "too frequent"? 
                        # Simple: Just don't run it every request.
                        # Or, run it inside the 'else' (DB exists) block but maybe cache it?
                        # For now, let's NOT run it every request, but assume init_db sets correct schema.
                        # Issue: migrate_nulls was a manual script.
                        # We need 'migrate_schema' if we have automatic migrations in code.
                        # app.py has: def migrate_schema(): ... creates flights table if not exists?
                        # Wait, init_db does that.
                        # migrate_schema in app.py logic:
                        # "CREATE TABLE IF NOT EXISTS ..."
                        # So it IS safe to run.
                        # But calling it every request is wasteful.
                        # Let's leave it out for now and rely on init_db for new users.
                        # Existing users might need manual migration if we change schema again.
                 except Exception as e:
                     print(f"DB check error: {e}")

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, 'db', None)
    if db is not None:
        db.close()

def login_required(view):
    import functools
    @functools.wraps(view)
    def wrapped_view(**kwargs):
        if g.user is None:
            return redirect(url_for('login'))
        return view(**kwargs)
    return wrapped_view

# --- Auth Routes ---
@app.route('/register', methods=('GET', 'POST'))
def register():
    if request.method == 'POST':
        username = request.form['username'].lower()
        password = request.form['password']
        invitation_code = request.form.get('invitation_code')
        error = None

        if not username:
            error = 'Username is required.'
        elif not password:
            error = 'Password is required.'
        elif invitation_code != 'FLIGHTLOG2026':
            error = 'Invalid invitation code.'
        
        if error is None:
            conn = database.get_users_db()
            try:
                # 1. Create User
                password_hash = werkzeug.security.generate_password_hash(password)
                
                # Assign a unique DB file
                # To be improved: sanitize username for filename or use UUID
                clean_username = "".join([c for c in username if c.isalpha() or c.isdigit()]).lower()
                db_filename = os.path.join(app.instance_path, f"user_{clean_username}.db")
                
                cur = conn.execute(
                    'INSERT INTO users (username, password_hash, db_filename) VALUES (?, ?, ?)',
                    (username, password_hash, db_filename)
                )
                conn.commit()
                
                # 2. Init User DB
                # Initialize the new user database with the schema
                database.init_db(target_db_path=db_filename)
                
                flash('Registration successful. Please log in.')
                return redirect(url_for('login'))
                
            except sqlite3.IntegrityError:
                error = f"User {username} is already registered."
            finally:
                conn.close()

        flash(error)

    return render_template('register.html')

@app.route('/login', methods=('GET', 'POST'))
def login():
    if request.method == 'POST':
        username = request.form['username'].lower()
        password = request.form['password']
        conn = database.get_users_db()
        error = None
        user = conn.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
        conn.close()

        if user is None:
            error = 'Incorrect username.'
        elif not werkzeug.security.check_password_hash(user['password_hash'], password):
            error = 'Incorrect password.'

        if error is None:
            session.clear()
            session['user_id'] = user['id']
            # flash('Login successful!') # Optional, maybe too noisy? User asked for it. 
            # Actually, standard UX: redirect to index. But user specifically asked for "login success" feedback.
            # Usually index page is enough, but let's add it if they want.
            # But wait, index page might not show flash? Let's assume templates support it (we will add it).
            # Let's add it.
            flash('Login successful!')
            return redirect(url_for('index'))

        flash(error)

    return render_template('login.html')

    return render_template('login.html')

@app.route('/api/profile/update', methods=['POST'])
@login_required
def update_profile():
    data = request.json
    new_username = data.get('username')
    new_password = data.get('password')
    
    if not new_username:
        return jsonify({'error': 'Username is required'}), 400
        
    new_username = new_username.lower()
        
    conn = database.get_users_db()
    try:
        # Check if username exists (if changed)
        if new_username != g.user['username']:
            existing = conn.execute('SELECT id FROM users WHERE username = ?', (new_username,)).fetchone()
            if existing:
                return jsonify({'error': 'Username already taken'}), 400
            
            conn.execute('UPDATE users SET username = ? WHERE id = ?', (new_username, g.user['id']))
            # Note: We do NOT rename the database file. It stays user_<original_name>.db to avoid complexity.
            
        if new_password:
            password_hash = werkzeug.security.generate_password_hash(new_password)
            conn.execute('UPDATE users SET password_hash = ? WHERE id = ?', (password_hash, g.user['id']))
            
        conn.commit()
        return jsonify({'message': 'Profile updated successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/')
@login_required
def index():
    # Pass user info to template for profile display
    user_info = {
        'id': g.user['id'],
        'username': g.user['username']
    }
    return render_template('index.html', user=user_info)

@app.route('/api/health')
def health():
    return jsonify({"status": "ok"})

# --- Helper Functions ---
def query_db(query, args=(), one=False):
    if not g.user: return None # Security check
    conn = database.get_db()
    cur = conn.execute(query, args)
    rv = [dict(row) for row in cur.fetchall()]
    # conn.close() # Managed by teardown
    return (rv[0] if rv else None) if one else rv

def execute_db(query, args=()):
    if not g.user: raise Exception("Unauthorized")
    conn = database.get_db()
    try:
        cur = conn.execute(query, args)
        conn.commit()
        lastrowid = cur.lastrowid
        # conn.close() # Managed by teardown
        return lastrowid
    except Exception as e:
        conn.rollback()
        # conn.close() # Managed by teardown
        raise e

def get_continent_from_tz(tz_name):
    """Extract continent from timezone string (e.g., 'Asia/Shanghai' -> 'Asia')."""
    if not tz_name or '/' not in tz_name:
        return None
    return tz_name.split('/')[0]

# --- CRUD Routes Generation Helper ---
def create_crud_routes(endpoint, table_name, columns):
    # GET all
    @app.route(f'/api/{endpoint}', methods=['GET'], endpoint=f'get_{endpoint}')
    @login_required
    def get_all():
        rows = query_db(f"SELECT * FROM {table_name}")
        return jsonify(rows)

    # POST create
    @app.route(f'/api/{endpoint}', methods=['POST'], endpoint=f'create_{endpoint}')
    @login_required
    def create_item():
        data = request.json
        valid_data = {k: v for k, v in data.items() if k in columns}

        # Special logic for flights duration
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
            except Exception as e:
                print(f"Error calculating duration: {e}")
            # finally:
            #    conn.close() # Managed by teardown

        if table_name == 'cities':
            if valid_data.get('timezone') and not valid_data.get('continent'):
                valid_data['continent'] = get_continent_from_tz(valid_data['timezone'])

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
    @login_required
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
            except Exception as e:
                 print(f"Error calculating duration update: {e}")
            # finally:
            #    conn.close() # Managed by teardown

        if table_name == 'cities':
             if 'timezone' in valid_data and (not valid_data.get('continent') or valid_data['continent'] == ''):
                  valid_data['continent'] = get_continent_from_tz(valid_data['timezone'])

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
    @login_required
    def delete_item(id):
        try:
            execute_db(f"DELETE FROM {table_name} WHERE id = ?", (id,))
            return jsonify({'message': 'Deleted', 'id': id})
        except Exception as e:
            return jsonify({'error': str(e)}), 500


# --- Define Entities ---
# Schema columns for validation (excluding id)
# Schema columns for validation (excluding id)
cities_cols = ['name', 'country', 'country_code', 'timezone', 'continent']
airports_cols = ['name', 'iata_code', 'icao_code', 'city_id', 'lat', 'lon', 'terminals', 'timezone']
airlines_cols = ['name', 'iata_code', 'icao_code', 'frequent_flyer_program', 'frequent_flyer_id']
aircraft_cols = ['manufacturer', 'model', 'series', 'subtype', 'tags_generation', 'tags_engine', 'tags_winglets', 'tags_config', 'name']
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
        if 'timezone' not in cities_cols_db:
             conn.execute("ALTER TABLE cities ADD COLUMN timezone TEXT")
        if 'continent' not in cities_cols_db:
             conn.execute("ALTER TABLE cities ADD COLUMN continent TEXT")
             print("Migrated: Added continent to cities")

        # Airlines
        cur = conn.execute("PRAGMA table_info(airlines)")
        airlines_cols_db = [row[1] for row in cur.fetchall()]
        if 'alliance' not in airlines_cols_db:
             conn.execute("ALTER TABLE airlines ADD COLUMN alliance TEXT")
             print("Migrated: Added alliance to airlines")
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
# Run migration on start
# with app.app_context():
#    migrate_schema()

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
@login_required
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

            if table_name == 'cities':
                if normalized_row.get('timezone') and not normalized_row.get('continent'):
                    normalized_row['continent'] = get_continent_from_tz(normalized_row['timezone'])

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
@login_required
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
                conn.execute("UPDATE cities SET country_code = ?, timezone = ?, continent = ? WHERE id = ?", 
                             (country_code, tz, get_continent_from_tz(tz), city_id))
            else:
                # Create New
                conn.execute("INSERT INTO cities (name, country, country_code, timezone, continent) VALUES (?, ?, ?, ?, ?)",
                            (city_name, country_code, country_code, tz, get_continent_from_tz(tz)))
                city_id = cur.lastrowid
        
        conn.execute("UPDATE airports SET city_id = ? WHERE id = ?", (city_id, id))
        updated_fields.append('city_id')
    
    return True, updated_fields

# --- API Routes for Automation ---
@app.route('/api/airports/<int:id>/update', methods=['POST'])
@login_required
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
@login_required
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
@login_required
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
@login_required
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
@login_required
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
@login_required
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

# --- FlightAware AeroAPI Integration ---

def fetch_aeroapi_data(ident, start_str, end_str):
    url = f"https://aeroapi.flightaware.com/aeroapi/flights/{ident}"
    headers = {"x-apikey": FLIGHTAWARE_API_KEY}
    params = {
        "start": start_str,
        "end": end_str,
        "max_pages": 1
    }
    
    try:
        response = requests.get(url, headers=headers, params=params)
    except Exception as e:
        raise ValueError(f"Connection Error: {e}")

    if response.status_code == 400:
        try:
            err = response.json()
            if 'too far in the past' in err.get('detail', ''):
                raise ValueError("Date exceeding API plan limit (10 days)")
            raise ValueError(f"API Error: {err.get('detail', 'Bad Request')}")
        except ValueError as ve:
            raise ve
        except:
            raise ValueError(f"API Error 400: {response.text}")
            
    if response.status_code != 200:
        raise ValueError(f"API Status {response.status_code}")

    data = response.json()
    return data.get('flights', [])

def get_or_create_airport(icao, iata, conn):
    if not iata and not icao: return None
    # Try by ICAO first
    if icao:
        cur = conn.execute("SELECT id FROM airports WHERE icao_code = ?", (icao,))
        row = cur.fetchone()
        if row: return row[0]
    
    # Try by IATA
    if iata:
        cur = conn.execute("SELECT id FROM airports WHERE iata_code = ?", (iata,))
        row = cur.fetchone()
        if row: return row[0]
        
    print(f"Creating new airport: {icao}/{iata}")
    # Create New Airport using airportsdata
    ad = airportsdata.load('ICAO')
    # If we only have IATA, airportsdata key is ICAO. Can we find it?
    # airportsdata can load by IATA too.
    info = None
    if icao:
        info = ad.get(icao)
    elif iata:
        ad_iata = airportsdata.load('IATA')
        info = ad_iata.get(iata)

    city_id = None
    if info:
        # Check/Create City
        city_name = info['city']
        cur = conn.execute("SELECT id, timezone, continent FROM cities WHERE name = ?", (city_name,))
        city_row = cur.fetchone()
        
        if city_row:
            city_id = city_row[0]
            # Backfill timezone/continent if missing
            db_tz = city_row[1]
            db_cont = city_row[2]
            new_tz = info.get('tz')
            
            # Ensure new_cont is calculated if not present in info (though airportsdata usually has it, but format check)
            # Actually airportsdata uses 'continent' key e.g. 'AS', 'EU'.
            # We want full names or consistent codes? User seems to use 'Asia'. 
            # Our helper get_continent_from_tz uses timezone split.
            # Let's rely on timezone for consistency if possible, or mapping.
            # airportsdata 'continent' is 2-letter. 'AS' -> 'Asia'?
            # Let's stick to get_continent_from_tz for consistency with other parts of app.
            
            new_cont_calc = get_continent_from_tz(new_tz)
            
            updates = []
            vals = []
            if not db_tz and new_tz:
                updates.append("timezone = ?")
                vals.append(new_tz)
            if not db_cont and new_cont_calc:
                updates.append("continent = ?")
                vals.append(new_cont_calc)
            
            if updates:
                vals.append(city_id)
                conn.execute(f"UPDATE cities SET {', '.join(updates)} WHERE id = ?", vals)
        else:
            # Try to guess timezone
            tz = info.get('tz')
            cont = get_continent_from_tz(tz)
            
            # Resolve Country Name
            country_code = info.get('country') # ISO 2-letter
            country_name = country_code
            try:
                import pycountry
                c_obj = pycountry.countries.get(alpha_2=country_code)
                if c_obj:
                    country_name = c_obj.name
            except:
                pass

            cur = conn.execute("INSERT INTO cities (name, country, country_code, timezone, continent) VALUES (?, ?, ?, ?, ?)", 
                             (city_name, country_name, country_code, tz, cont))
            city_id = cur.lastrowid
            
        cur = conn.execute('''
            INSERT INTO airports (city_id, name, iata_code, icao_code, lat, lon, timezone)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (city_id, info['name'], info.get('iata'), info.get('icao'), info['lat'], info['lon'], info.get('tz')))
        return cur.lastrowid
    
    return None

def get_or_create_airline(icao, iata, conn):
    if not icao: return None 
    cur = conn.execute("SELECT id FROM airlines WHERE icao_code = ?", (icao,))
    row = cur.fetchone()
    if row: return row[0]
    
    name = icao # Default
    new_iata = iata
    
    # Auto-create with ICAO as name (User request)
    # We no longer check against AIRLINES_BY_ICAO to avoid crashes if missing
        
    cur = conn.execute("INSERT INTO airlines (name, iata_code, icao_code) VALUES (?, ?, ?)", (name, new_iata, icao))
    return cur.lastrowid

# --- Calculation API ---
@app.route('/api/calculate_duration', methods=['POST'])
def calculate_duration():
    data = request.json
    start_str = data.get('start')
    end_str = data.get('end')
    origin_id = data.get('origin_id')
    dest_id = data.get('dest_id')

    if not start_str or not end_str or not origin_id or not dest_id:
        return jsonify({'error': 'Missing parameters'}), 400

    try:
        conn = database.get_db()
        # Fetch timezones
        cur = conn.execute("SELECT timezone FROM airports WHERE id = ?", (origin_id,))
        origin_row = cur.fetchone()
        cur = conn.execute("SELECT timezone FROM airports WHERE id = ?", (dest_id,))
        dest_row = cur.fetchone()

        if not origin_row or not dest_row:
             return jsonify({'error': 'Airports not found'}), 404

        tz_origin_str = origin_row[0]
        tz_dest_str = dest_row[0]

        # Parse Naive
        dt_start = dateutil.parser.parse(start_str)
        dt_end = dateutil.parser.parse(end_str)

        # Localize
        if tz_origin_str:
            try:
                tz_origin = pytz.timezone(tz_origin_str)
                # If dt_start is naive, localize it
                if dt_start.tzinfo is None:
                    dt_start = tz_origin.localize(dt_start)
            except Exception as e:
                print(f"Timezone error origin: {e}")

        if tz_dest_str:
            try:
                tz_dest = pytz.timezone(tz_dest_str)
                if dt_end.tzinfo is None:
                    dt_end = tz_dest.localize(dt_end)
            except Exception as e:
                print(f"Timezone error dest: {e}")

        # Calculate Difference
        diff = dt_end - dt_start
        minutes = int(diff.total_seconds() / 60)
        
        return jsonify({'minutes': minutes})

    except Exception as e:
        return jsonify({'error': str(e)}), 500

# --- Stats API ---
@app.route('/api/stats', methods=['GET'])
def get_stats():
    conn = database.get_db()
    
    stats = {
        'totals': {},
        'top': {},
        'breakdowns': {}
    }
    
    # Totals
    stats['totals']['flights'] = conn.execute("SELECT COUNT(*) FROM flights").fetchone()[0]
    stats['totals']['airlines'] = conn.execute("SELECT COUNT(DISTINCT airline_id) FROM flights").fetchone()[0]
    stats['totals']['aircraft'] = conn.execute("""
        SELECT COUNT(DISTINCT am.model || ' ' || am.series) 
        FROM flights f 
        JOIN aircraft_models am ON f.aircraft_model_id = am.id
    """).fetchone()[0]
    stats['totals']['routes'] = conn.execute("SELECT COUNT(DISTINCT origin_airport_id || '-' || dest_airport_id) FROM flights").fetchone()[0]
    
    # Complex Totals (Countries, Continents)
    # Get all visited city IDs (origin + dest)
    conn.execute("CREATE TEMP TABLE visited_cities AS SELECT city_id FROM airports WHERE id IN (SELECT origin_airport_id FROM flights UNION SELECT dest_airport_id FROM flights)")
    stats['totals']['cities'] = conn.execute("SELECT COUNT(DISTINCT city_id) FROM visited_cities").fetchone()[0]
    stats['totals']['countries'] = conn.execute("SELECT COUNT(DISTINCT country) FROM cities WHERE id IN (SELECT city_id FROM visited_cities)").fetchone()[0]
    stats['totals']['continents'] = conn.execute("SELECT COUNT(DISTINCT continent) FROM cities WHERE id IN (SELECT city_id FROM visited_cities) AND continent IS NOT NULL").fetchone()[0]
    stats['totals']['airports'] = conn.execute("SELECT COUNT(DISTINCT id) FROM airports WHERE id IN (SELECT origin_airport_id FROM flights UNION SELECT dest_airport_id FROM flights)").fetchone()[0]
    
    conn.execute("DROP TABLE visited_cities")
    
    # Top Lists Helper
    def get_top(query, params=()):
        return [{'name': r[0], 'count': r[1], 'extra': r[2] if len(r)>2 else None} for r in conn.execute(query, params).fetchall()]

    # Top Continents
    # Count flights involving continent? Or just distinct visits? User says "sorted from large to small". Usually flight count.
    # We count a flight as "touching" a continent if origin OR dest is there? Or just Origin?
    # Simple: Join Origin.
    # Top Continents (Origin + Dest)
    stats['top']['continents'] = get_top("""
        SELECT c.continent, COUNT(*) as cnt
        FROM (
            SELECT origin_airport_id as aid FROM flights
            UNION ALL
            SELECT dest_airport_id as aid FROM flights
        ) t
        JOIN airports a ON t.aid = a.id
        JOIN cities c ON a.city_id = c.id
        WHERE c.continent IS NOT NULL AND c.continent != ''
        GROUP BY c.continent
        ORDER BY cnt DESC
    """)
    
    # Top Countries (Origin + Dest)
    stats['top']['countries'] = get_top("""
        SELECT c.country, COUNT(*) as cnt, c.country_code
        FROM (
            SELECT origin_airport_id as aid FROM flights
            UNION ALL
            SELECT dest_airport_id as aid FROM flights
        ) t
        JOIN airports a ON t.aid = a.id
        JOIN cities c ON a.city_id = c.id
        GROUP BY c.country 
        ORDER BY cnt DESC
    """)

    # Top Cities (Origin + Dest)
    stats['top']['cities'] = get_top("""
        SELECT c.name, COUNT(*) as cnt, c.country_code
        FROM (
            SELECT origin_airport_id as aid FROM flights
            UNION ALL
            SELECT dest_airport_id as aid FROM flights
        ) t
        JOIN airports a ON t.aid = a.id
        JOIN cities c ON a.city_id = c.id
        GROUP BY c.id
        ORDER BY cnt DESC
    """)
    
    # Top Airports (Dep + Arr)
    stats['top']['airports'] = get_top("""
        SELECT a.iata_code, COUNT(*) as cnt, a.name
        FROM (
            SELECT origin_airport_id as aid FROM flights
            UNION ALL
            SELECT dest_airport_id as aid FROM flights
        ) t
        JOIN airports a ON t.aid = a.id
        GROUP BY a.iata_code
        ORDER BY cnt DESC
    """)
    
    # Top Routes
    stats['top']['routes'] = get_top("""
        SELECT a1.iata_code || '-' || a2.iata_code, COUNT(*) as cnt
        FROM flights f
        JOIN airports a1 ON f.origin_airport_id = a1.id
        JOIN airports a2 ON f.dest_airport_id = a2.id
        GROUP BY f.origin_airport_id, f.dest_airport_id
        ORDER BY cnt DESC
    """)
    
    # Top Airlines
    stats['top']['airlines'] = get_top("""
        SELECT al.name, COUNT(*) as cnt, al.frequent_flyer_program
        FROM flights f
        JOIN airlines al ON f.airline_id = al.id
        GROUP BY al.id
        ORDER BY cnt DESC
    """)
    
    # Flights by Year (for Chart)
    stats['flights_by_year'] = [{'year': r[0], 'count': r[1]} for r in conn.execute("SELECT strftime('%Y', date) as y, COUNT(*) FROM flights WHERE date IS NOT NULL AND date != '' GROUP BY y ORDER BY y ASC").fetchall()]
    
    # Top Aircraft (Model + Series)
    stats['top']['aircraft'] = get_top("""
        SELECT am.model || ' ' || am.series, COUNT(*) as cnt, am.manufacturer
        FROM flights f
        JOIN aircraft_models am ON f.aircraft_model_id = am.id
        GROUP BY am.model, am.series
        ORDER BY cnt DESC
    """)
    
    # Breakdowns
    # Alliance (Use frequent_flyer_program as user requested)
    stats['breakdowns']['alliance'] = {r[0]: r[1] for r in conn.execute("""
        SELECT al.frequent_flyer_program, COUNT(*) 
        FROM flights f JOIN airlines al ON f.airline_id = al.id 
        WHERE al.frequent_flyer_program IS NOT NULL AND al.frequent_flyer_program != ''
        GROUP BY al.frequent_flyer_program
    """).fetchall()}
    
    # Manufacturer
    stats['breakdowns']['manufacturer'] = {r[0]: r[1] for r in conn.execute("""
        SELECT am.manufacturer, COUNT(*) 
        FROM flights f JOIN aircraft_models am ON f.aircraft_model_id = am.id 
        GROUP BY am.manufacturer
    """).fetchall()}

    return jsonify(stats)

@app.route('/api/flights/detailed', methods=['GET'])
def get_detailed_flights():
    conn = database.get_db()
    # Complex query to satisfy both Flight Log (flat, detailed) and Profile Map (geo-coordinates)
    cursor = conn.execute('''
        SELECT f.*, 
               oa.iata_code as origin_code, oa.name as origin_name, oa.lat as origin_lat, oa.lon as origin_lon, oa.city_id as origin_city_id,
               da.iata_code as dest_code, da.name as dest_name, da.lat as dest_lat, da.lon as dest_lon, da.city_id as dest_city_id,
               al.name as airline_name,
               am.manufacturer || ' ' || am.model as aircraft_model,
               am.manufacturer,
               am.tags_generation as tag_generation, 
               am.tags_winglets as tag_winglets, 
               am.tags_config as tag_config
        FROM flights f
        LEFT JOIN airports oa ON f.origin_airport_id = oa.id
        LEFT JOIN airports da ON f.dest_airport_id = da.id
        LEFT JOIN airlines al ON f.airline_id = al.id
        LEFT JOIN aircraft_models am ON f.aircraft_model_id = am.id
        ORDER BY f.date DESC
    ''')
    
    flights = []
    col_names = [d[0] for d in cursor.description]
    
    for row in cursor.fetchall():
        item = dict(zip(col_names, row))
        
        # Add nested objects for Profile Map compatibility
        item['origin'] = {
            'lat': item['origin_lat'], 
            'lon': item['origin_lon'], 
            'code': item['origin_code'], 
            'name': item['origin_name']
        }
        item['dest'] = {
            'lat': item['dest_lat'], 
            'lon': item['dest_lon'], 
            'code': item['dest_code'], 
            'name': item['dest_name']
        }
        
        flights.append(item)
        
    conn.close()
    return jsonify(flights)

def update_single_flight_from_aeroapi(flight_id, force=False):
    conn = database.get_db()
    # Indices: 0=f_num, 1=date, 2=orig_id, 3=dest_id, 4=std, 5=atd, 6=sta, 7=ata, 8=reg, 9=airline, 10=model, 11=dist, 12=dur_sched, 13=dur_actual, 14=oterm, 15=dterm
    cur = conn.execute("SELECT flight_number, date, origin_airport_id, dest_airport_id, std, atd, sta, ata, registration, airline_id, aircraft_model_id, distance, duration_scheduled, duration_actual, origin_terminal, dest_terminal FROM flights WHERE id = ?", (flight_id,))
    flight = cur.fetchone()
    
    if not flight:
        conn.close()
        return {'error': 'Flight not found'}
        
    f_num = flight[0]
    f_date = flight[1]
    
    if not f_num or not f_date:
        conn.close()
        return {'error': 'Missing flight number or date'}

    # Strategy: Always fetch if forced, OR if missing critical data 
    is_missing_data = not (flight[4] and flight[5] and flight[8])
    if not force and not is_missing_data:
         conn.close()
         return {'message': 'Skipped, data exists'}
         
    f_num_clean = f_num.replace(' ', '')
    f_dt = dateutil.parser.parse(f_date)
    start_window = (f_dt - timedelta(days=1)).strftime('%Y-%m-%dT%H:%M:%SZ')
    end_window = (f_dt + timedelta(days=2)).strftime('%Y-%m-%dT%H:%M:%SZ') 
    
    try:
        raw_flights = fetch_aeroapi_data(f_num_clean, start_window, end_window)
    except ValueError as e:
        conn.close()
        return {'error': str(e)}
    except Exception as e:
        conn.close()
        return {'error': 'API unexpected error'}
    
    if not raw_flights:
        conn.close()
        if force: return {'error': 'No data found in AeroAPI'}
        return {'message': 'No data found'}

    best_match = None
    closest_diff = float('inf')
    
    for f in raw_flights:
        t_str = f.get('scheduled_out') or f.get('actual_out')
        if not t_str: continue
        
        t = dateutil.parser.parse(t_str).replace(tzinfo=None) 
        diff = abs((t - f_dt).total_seconds())
        if diff < 36 * 3600:
            if diff < closest_diff:
                closest_diff = diff
                best_match = f
            
    if not best_match:
        conn.close()
        if force: return {'error': 'No matching flight in time window'}
        return {'message': 'No matching flight'}

    print(f"DEBUG: Best match for {f_num} on {f_date}: {best_match.get('ident')} at {best_match.get('scheduled_out')}")
        
    api_std = best_match.get('scheduled_out')
    api_atd = best_match.get('actual_out')
    api_sta = best_match.get('scheduled_in')
    api_ata = best_match.get('actual_in')
    api_reg = best_match.get('registration')
    
    # Calculate Durations (UTC diff)
    dur_sched = None
    if api_std and api_sta:
        try:
             d1 = dateutil.parser.parse(api_std)
             d2 = dateutil.parser.parse(api_sta)
             dur_sched = int((d2 - d1).total_seconds() / 60)
        except: pass
        
    dur_actual = None
    if api_atd and api_ata:
        try:
             d1 = dateutil.parser.parse(api_atd)
             d2 = dateutil.parser.parse(api_ata)
             dur_actual = int((d2 - d1).total_seconds() / 60)
        except: pass
    
    # Distance conversion: Miles -> KM
    api_dist = best_match.get('route_distance')
    if api_dist is not None:
        try:
            api_dist = int(api_dist * 1.60934)
        except:
            pass
    
    api_origin_code = best_match.get('origin', {}).get('code')
    api_dest_code = best_match.get('destination', {}).get('code')

    def _fmt_term(t):
        if t and t.isdigit(): return f"T{t}"
        return t

    api_origin_term = _fmt_term(best_match.get('terminal_origin'))
    api_dest_term = _fmt_term(best_match.get('terminal_destination'))
    
    api_origin_tz = best_match.get('origin', {}).get('timezone')
    api_dest_tz = best_match.get('destination', {}).get('timezone')

    def to_local_str(utc_str, tz_name):
        if not utc_str: return None
        try:
            dt_utc = dateutil.parser.parse(utc_str)
            if tz_name:
                try:
                    tz = pytz.timezone(tz_name)
                    dt_local = dt_utc.astimezone(tz)
                    return dt_local.strftime('%Y-%m-%d %H:%M:%S')
                except:
                     return dt_utc.strftime('%Y-%m-%d %H:%M:%S')
            else:
                return dt_utc.strftime('%Y-%m-%d %H:%M:%S')
        except:
            return utc_str

    api_std = to_local_str(api_std, api_origin_tz)
    api_atd = to_local_str(api_atd, api_origin_tz)
    api_sta = to_local_str(api_sta, api_dest_tz)
    api_ata = to_local_str(api_ata, api_dest_tz)
    
    update_fields = []
    update_values = []
    
    def add_update(col, val, current_val):
        if val is not None and (force or not current_val):
             update_fields.append(f"{col} = ?")
             update_values.append(val)

    add_update('std', api_std, flight[4])
    add_update('atd', api_atd, flight[5])
    add_update('sta', api_sta, flight[6])
    add_update('ata', api_ata, flight[7])
    
    add_update('registration', api_reg, flight[8])
    add_update('distance', api_dist, flight[11])
    
    add_update('duration_scheduled', dur_sched, flight[12])
    add_update('duration_actual', dur_actual, flight[13])
    
    # Terminals
    add_update('origin_terminal', api_origin_term, flight[14])
    add_update('dest_terminal', api_dest_term, flight[15])

    
    # helper for airport terminals update
    def ensure_terminal_in_db(airport_id, term):
        if not airport_id or not term: return
        try:
            cur = conn.execute("SELECT terminals FROM airports WHERE id = ?", (airport_id,))
            row = cur.fetchone()
            if row:
                terms_str = row[0] or ""
                terms_list = [t.strip() for t in terms_str.split(',') if t.strip()]
                if term not in terms_list:
                    print(f"Adding terminal {term} to airport {airport_id}")
                    terms_list.append(term)
                    terms_list.sort()
                    new_str = ", ".join(terms_list)
                    conn.execute("UPDATE airports SET terminals = ? WHERE id = ?", (new_str, airport_id))
        except Exception as e:
            print(f"Error updating airport terminals: {e}")

    # Origin/Dest Airports
    if api_origin_code:
        aid = get_or_create_airport(api_origin_code, None, conn)
        if aid:
            if not flight[2]: # Only update airport if missing
                 update_fields.append("origin_airport_id = ?")
                 update_values.append(aid)
            target_aid = flight[2] if flight[2] else aid
            ensure_terminal_in_db(target_aid, api_origin_term)

    if api_dest_code:
        aid = get_or_create_airport(api_dest_code, None, conn)
        if aid:
            if not flight[3]:
                 update_fields.append("dest_airport_id = ?")
                 update_values.append(aid)
            target_aid = flight[3] if flight[3] else aid
            ensure_terminal_in_db(target_aid, api_dest_term)
             
    # Airline
    api_airline = best_match.get('operator')
    if api_airline and not flight[9]: # Only if missing
         al_id = get_or_create_airline(api_airline, None, conn)
         if al_id:
              update_fields.append("airline_id = ?")
              update_values.append(al_id)

    if not update_fields:
        return {'message': 'No new data or data already exists'}
        
    update_values.append(flight_id)
    sql = f"UPDATE flights SET {', '.join(update_fields)} WHERE id = ?"
    conn.execute(sql, update_values)
    conn.commit()
    
    return {'success': True, 'fields_updated': len(update_fields), 'debug_match': best_match.get('ident')}

import pycountry
import traceback

@app.route('/api/flights/<int:flight_id>/update_aeroapi', methods=['POST'])
def update_flight_aeroapi(flight_id):
    try:
        result = update_single_flight_from_aeroapi(flight_id, force=True)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/flights/update_aeroapi_missing', methods=['POST'])
def update_missing_flights_aeroapi():
    conn = database.get_db()
    cur = conn.execute('''
        SELECT id FROM flights 
        WHERE (std IS NULL OR atd IS NULL OR registration IS NULL OR registration = '')
        AND flight_number IS NOT NULL AND date IS NOT NULL
    ''')
    rows = cur.fetchall()
    
    updated_count = 0
    errors = []
    
    for row in rows:
        fid = row[0]
        res = update_single_flight_from_aeroapi(fid, force=False)
        if res.get('success'):
            updated_count += 1
        elif res.get('error'):
            pass # Silent fail for bulk? Or log?
            # errors.append(f"Flight {fid}: {res['error']}")
            
    return jsonify({'updated': updated_count, 'total_candidates': len(rows)})

if __name__ == '__main__':
    # Initialize DB (safe to run multiple times)
    with app.app_context():
        database.init_db()
    app.run(debug=True, port=5000)
