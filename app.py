from flask import Flask, render_template, jsonify, request, g, session, redirect, url_for, flash, current_app
import os
from dotenv import load_dotenv
from cryptography.fernet import Fernet
import database
import requests
import dateutil.parser
import airportsdata
from datetime import datetime, time, timedelta
import pytz
import json
import re
import socket
import ipaddress
import uuid
from urllib.parse import urlparse
import werkzeug.security
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_wtf.csrf import CSRFProtect, CSRFError
from werkzeug.middleware.proxy_fix import ProxyFix

load_dotenv()

app = Flask(__name__)

# --- Proxy Configuration (Critical for 1Panel/Docker) ---
# Tell Flask to trust headers from the reverse proxy (Nginx).
# x_for=1: Trust the first X-Forwarded-For header (Client IP)
# x_proto=1: Trust X-Forwarded-Proto (HTTP/HTTPS)
# x_host=1: Trust X-Forwarded-Host
# x_port=1: Trust X-Forwarded-Port
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_port=1)

# --- Security Setup ---
# Rate Limiting
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"],
    storage_uri="memory://"
)

# CSRF Protection
csrf = CSRFProtect(app)

@app.errorhandler(CSRFError)
def handle_csrf_error(e):
    return render_template('error.html', reason=e.description), 400

def safe_jsonify_error(e):
    """Return generic error in production, detailed in debug."""
    if app.debug:
        return jsonify({'error': str(e)}), 500
    print(f"Internal Error: {e}") # Log it
    return jsonify({'error': 'An internal error occurred.'}), 500

FLIGHT_NULLABLE_NUMERIC_FIELDS = {
    'airline_id',
    'aircraft_model_id',
    'origin_airport_id',
    'dest_airport_id',
    'distance',
    'duration_scheduled',
    'duration_actual',
}

def normalize_flight_payload(data):
    normalized = dict(data)
    for field in FLIGHT_NULLABLE_NUMERIC_FIELDS:
        if normalized.get(field) == '':
            normalized[field] = None
    return normalized

AEROAPI_CONFIRM_FIELDS = [
    ('std', 'Scheduled Departure'),
    ('atd', 'Actual Departure'),
    ('sta', 'Scheduled Arrival'),
    ('ata', 'Actual Arrival'),
    ('registration', 'Aircraft Registration'),
    ('distance', 'Distance'),
    ('duration_scheduled', 'Scheduled Duration'),
    ('duration_actual', 'Actual Duration'),
    ('origin_terminal', 'Origin Terminal'),
    ('dest_terminal', 'Destination Terminal'),
    ('flight_class', 'Class'),
]

AEROAPI_CONFIRM_FIELD_NAMES = {field for field, _ in AEROAPI_CONFIRM_FIELDS}

def _is_empty_value(value):
    return value is None or value == ''

def _values_equal(local_value, remote_value):
    return str(local_value).strip() == str(remote_value).strip()

def build_aeroapi_field_diffs(local_values, remote_values):
    diffs = []
    for field, label in AEROAPI_CONFIRM_FIELDS:
        remote_value = remote_values.get(field)
        if remote_value is None:
            continue

        local_value = local_values.get(field)
        if _is_empty_value(local_value):
            status = 'missing'
            default_selected = True
        elif _values_equal(local_value, remote_value):
            status = 'same'
            default_selected = False
        else:
            status = 'conflict'
            default_selected = False

        diffs.append({
            'field': field,
            'label': label,
            'local': local_value,
            'remote': remote_value,
            'status': status,
            'default_selected': default_selected
        })
    return diffs

_secret_key = os.environ.get('FLASK_SECRET_KEY')
if not _secret_key:
    raise RuntimeError("FLASK_SECRET_KEY not set in environment. This is required for secure sessions.")
app.secret_key = _secret_key

# Secure session cookie settings
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
# Enable the line below when serving over HTTPS in production:
# app.config['SESSION_COOKIE_SECURE'] = True

# --- Encryption Setup ---
_MASTER_KEY = os.environ.get('MASTER_SECRET_KEY')
if not _MASTER_KEY:
    raise RuntimeError("MASTER_SECRET_KEY not set. Copy .env.example to .env and fill in the value.")
_fernet = Fernet(_MASTER_KEY.encode())

def _encrypt_api_key(plain: str) -> str:
    return _fernet.encrypt(plain.encode()).decode()

def _decrypt_api_key(cipher: str) -> str:
    return _fernet.decrypt(cipher.encode()).decode()

def _get_user_api_key() -> str:
    """Return the current user's decrypted FlightAware API key. Raises ValueError if not set."""
    encrypted = g.user['api_key_encrypted'] if g.user else None
    if not encrypted:
        raise ValueError("FlightAware API key not configured. Set it via Edit Profile.")
    return _decrypt_api_key(encrypted)

def migrate_airlines_website_url():
    try:
        raw_conn = database._raw_connect()
        cur = raw_conn.cursor()
        cur.execute("""
            SELECT COLUMN_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'airlines'
              AND COLUMN_NAME = 'website_url'
        """)
        if not cur.fetchone():
            cur.execute("ALTER TABLE airlines ADD COLUMN website_url TEXT")
            raw_conn.commit()
            print("Migrated airlines table: added website_url column")
        raw_conn.close()
    except Exception as e:
        if getattr(e, 'args', [None])[0] != 1060:
            print(f"migrate_airlines_website_url error: {e}")

def migrate_airline_logo_metadata():
    try:
        raw_conn = database._raw_connect()
        cur = raw_conn.cursor()
        for column, definition in [('logo_source_url', 'TEXT'), ('logo_file_id', 'VARCHAR(255)')]:
            cur.execute("""
                SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'airlines' AND COLUMN_NAME = %s
            """, (column,))
            if not cur.fetchone():
                cur.execute(f"ALTER TABLE airlines ADD COLUMN {column} {definition}")
        raw_conn.commit()
        raw_conn.close()
    except Exception as e:
        if getattr(e, 'args', [None])[0] != 1060:
            print(f"migrate_airline_logo_metadata error: {e}")

# --- Migrate users DB at startup ---
with app.app_context():
    database.migrate_users_db()
    migrate_airlines_website_url()
    migrate_airline_logo_metadata()

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
@limiter.limit("5 per hour")
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
        elif invitation_code != os.environ.get('INVITATION_CODE'):
            error = 'Invalid invitation code.'
        
        if error is None:
            conn = database.get_users_db()
            try:
                password_hash = werkzeug.security.generate_password_hash(password)
                conn.execute(
                    'INSERT INTO users (username, password_hash) VALUES (?, ?)',
                    (username, password_hash)
                )
                conn.commit()
                flash('Registration successful. Please log in.', 'success')
                return redirect(url_for('login'))
            except Exception as e:
                if 'Duplicate entry' in str(e) or 'UNIQUE' in str(e):
                    error = f"User {username} is already registered."
                else:
                    error = str(e)
            finally:
                conn.close()

        flash(error, 'error')

    return render_template('register.html')

@app.route('/login', methods=('GET', 'POST'))
@limiter.limit("10 per minute")
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
            flash('Login successful!', 'success')
            return redirect(url_for('index'))

        flash(error, 'error')

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
        return safe_jsonify_error(e)
    finally:
        conn.close()

@app.route('/api/profile/api-key', methods=['GET'])
@login_required
def get_api_key_status():
    configured = bool(g.user['api_key_encrypted'])
    return jsonify({'configured': configured})

@app.route('/api/profile/api-key', methods=['POST'])
@login_required
def save_api_key():
    data = request.json
    api_key = data.get('api_key', '').strip()
    if not api_key:
        return jsonify({'error': 'API key is required'}), 400
    try:
        encrypted = _encrypt_api_key(api_key)
        conn = database.get_users_db()
        conn.execute('UPDATE users SET api_key_encrypted = ? WHERE id = ?', (encrypted, g.user['id']))
        conn.commit()
        conn.close()
        return jsonify({'message': 'API key saved successfully'})
    except Exception as e:
        return safe_jsonify_error(e)

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
@limiter.exempt
def health():
    return jsonify({"status": "ok"})

# --- Helper Functions ---
def query_db(query, args=(), one=False):
    if not g.user: return None # Security check
    conn = database.get_db()
    cur = conn.execute(query, args)
    if cur.description is None:
        return None
    cols = [d[0] for d in cur.description]
    rv = [dict(zip(cols, row)) for row in cur.fetchall()]
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

TENANT_RELATIONSHIPS = {
    'airports': {
        'city_id': 'cities',
    },
    'flights': {
        'airline_id': 'airlines',
        'aircraft_model_id': 'aircraft_models',
        'origin_airport_id': 'airports',
        'dest_airport_id': 'airports',
    },
}

def validate_tenant_relationships(conn, table_name, data, uid):
    """Reject relationship IDs that are not owned by the current user."""
    for field, related_table in TENANT_RELATIONSHIPS.get(table_name, {}).items():
        related_id = data.get(field)
        if related_id in (None, ''):
            continue
        row = conn.execute(
            f"SELECT 1 FROM {related_table} WHERE id = ? AND user_id = ?",
            (related_id, uid)
        ).fetchone()
        if not row:
            raise ValueError(f"Invalid {field}: related record does not belong to current user")

# --- CRUD Routes Generation Helper ---
def create_crud_routes(endpoint, table_name, columns):
    # GET all
    @app.route(f'/api/{endpoint}', methods=['GET'], endpoint=f'get_{endpoint}')
    @login_required
    def get_all():
        rows = query_db(f"SELECT * FROM {table_name} WHERE user_id = ?", (g.user['id'],))
        return jsonify(rows)

    # POST create
    @app.route(f'/api/{endpoint}', methods=['POST'], endpoint=f'create_{endpoint}')
    @login_required
    def create_item():
        data = request.json
        valid_data = {k: v for k, v in data.items() if k in columns}
        
        # Normalize empty strings to None only for numeric/decimal fields in airports
        if table_name == 'airports':
            for field in ['lat', 'lon', 'city_id']:
                if valid_data.get(field) == '':
                    valid_data[field] = None

        # Special logic for flights duration
        # Special logic for flights duration
        if table_name == 'flights':
            valid_data = normalize_flight_payload(valid_data)
            conn = database.get_db()
            try:
                origin_id = valid_data.get('origin_airport_id')
                dest_id = valid_data.get('dest_airport_id')
                if origin_id and dest_id:

                    if valid_data.get('std') and valid_data.get('sta') and not valid_data.get('duration_scheduled'):
                        valid_data['duration_scheduled'] = _calc_duration_minutes(conn, origin_id, dest_id, valid_data['std'], valid_data['sta'])
                    if valid_data.get('atd') and valid_data.get('ata') and not valid_data.get('duration_actual'):
                        valid_data['duration_actual'] = _calc_duration_minutes(conn, origin_id, dest_id, valid_data['atd'], valid_data['ata'])
            except Exception as e:
                print(f"Error calculating duration: {e}")
            # finally:
            #    conn.close() # Managed by teardown

        if table_name == 'cities':
            if valid_data.get('timezone') and not valid_data.get('continent'):
                valid_data['continent'] = get_continent_from_tz(valid_data['timezone'])

        if not valid_data:
             return jsonify({'error': 'No valid data provided'}), 400
        
        valid_data['user_id'] = g.user['id']
        cols = ', '.join(valid_data.keys())
        placeholders = ', '.join(['?'] * len(valid_data))
        values = list(valid_data.values())
        
        try:
            validate_tenant_relationships(database.get_db(), table_name, valid_data, g.user['id'])
            new_id = execute_db(f"INSERT INTO {table_name} ({cols}) VALUES ({placeholders})", values)
            new_item = query_db(f"SELECT * FROM {table_name} WHERE id = ? AND user_id = ?", (new_id, g.user['id']), one=True)
            return jsonify(new_item), 201
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
        except Exception as e:
            return safe_jsonify_error(e)

    # PUT update
    @app.route(f'/api/{endpoint}/<int:id>', methods=['PUT'], endpoint=f'update_{endpoint}')
    @login_required
    def update_item(id):
        data = request.json
        valid_data = {k: v for k, v in data.items() if k in columns}
        
        # Normalize empty strings to None only for numeric/decimal fields in airports
        if table_name == 'airports':
            for field in ['lat', 'lon', 'city_id']:
                if valid_data.get(field) == '':
                    valid_data[field] = None

        # Special logic for flights duration
        if table_name == 'flights':
            valid_data = normalize_flight_payload(valid_data)
            conn = database.get_db()
            try:
                # Fetch existing to compare or fill
                cur = conn.execute("SELECT origin_airport_id, dest_airport_id, std, sta, atd, ata FROM flights WHERE id = ? AND user_id = ?", (id, g.user['id']))
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
                        valid_data['duration_scheduled'] = _calc_duration_minutes(conn, merged['origin_airport_id'], merged['dest_airport_id'], merged['std'], merged['sta'])
                    if merged['atd'] and merged['ata'] and not valid_data.get('duration_actual'):
                        valid_data['duration_actual'] = _calc_duration_minutes(conn, merged['origin_airport_id'], merged['dest_airport_id'], merged['atd'], merged['ata'])
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
        values.extend([id, g.user['id']])
        
        try:
            validate_tenant_relationships(database.get_db(), table_name, valid_data, g.user['id'])
            execute_db(f"UPDATE {table_name} SET {set_clause} WHERE id = ? AND user_id = ?", values)
            updated_item = query_db(f"SELECT * FROM {table_name} WHERE id = ? AND user_id = ?", (id, g.user['id']), one=True)
            return jsonify(updated_item)
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
        except Exception as e:
            return safe_jsonify_error(e)

    # DELETE
    @app.route(f'/api/{endpoint}/<int:id>', methods=['DELETE'], endpoint=f'delete_{endpoint}')
    @login_required
    def delete_item(id):
        try:
            execute_db(f"DELETE FROM {table_name} WHERE id = ? AND user_id = ?", (id, g.user['id']))
            return jsonify({'message': 'Deleted', 'id': id})
        except Exception as e:
            return safe_jsonify_error(e)


# --- Define Entities ---
# Schema columns for validation (excluding id)
# Schema columns for validation (excluding id)
cities_cols = ['name', 'country', 'country_code', 'timezone', 'continent']
airports_cols = ['name', 'iata_code', 'icao_code', 'city_id', 'lat', 'lon', 'terminals', 'timezone']
airlines_cols = ['name', 'iata_code', 'icao_code', 'callsign', 'country', 'alliance', 'frequent_flyer_program', 'frequent_flyer_id', 'website_url', 'logo_url', 'logo_source_url', 'logo_file_id']
aircraft_cols = ['manufacturer', 'model', 'series', 'subtype', 'tags_generation', 'tags_engine', 'tags_winglets', 'tags_config', 'name']
flights_cols = ['date', 'flight_number', 'airline_id', 'aircraft_model_id', 'origin_airport_id', 'dest_airport_id',
                'dep_time_scheduled', 'arr_time_scheduled', 'seat_number', 'seat_type', 'flight_class', 'note',
                'origin_terminal', 'dest_terminal', 'tag_generation', 'tag_winglets', 'tag_config',
                'registration', 'distance', 'duration_scheduled', 'duration_actual',
                'std', 'atd', 'sta', 'ata']

# --- Auto-Migration Helper ---
def migrate_schema():
    """No-op in MySQL mode — schema is fully managed via schema_mysql.sql."""
    pass

create_crud_routes('cities', 'cities', cities_cols)
create_crud_routes('airports', 'airports', airports_cols)
create_crud_routes('airlines', 'airlines', airlines_cols)
create_crud_routes('aircraft_models', 'aircraft_models', aircraft_cols)
create_crud_routes('flights', 'flights', flights_cols)


# --- Airline Logo Management ---
MAX_AIRLINE_LOGO_BYTES = 1024 * 1024
ALLOWED_AIRLINE_LOGO_TYPES = {'image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'}


def validate_public_image_url(source_url):
    parsed = urlparse((source_url or '').strip())
    if parsed.scheme not in ('http', 'https') or not parsed.hostname:
        raise ValueError('Logo URL must use HTTP or HTTPS')
    try:
        addresses = socket.getaddrinfo(parsed.hostname, parsed.port or (443 if parsed.scheme == 'https' else 80))
    except socket.gaierror as e:
        raise ValueError('Logo URL hostname could not be resolved') from e
    for address in addresses:
        address = ipaddress.ip_address(address[4][0])
        if not address.is_global:
            raise ValueError('Logo URL must resolve to a public address')
    return parsed.geturl()


def _import_logo_to_imagekit(source_url, airline_id):
    private_key = os.environ.get('IMAGEKIT_PRIVATE_KEY')
    url_endpoint = os.environ.get('IMAGEKIT_URL_ENDPOINT')
    if not private_key or not url_endpoint:
        return None
    response = requests.post(
        'https://upload.imagekit.io/api/v1/files/upload',
        auth=(private_key, ''),
        data={
            'file': source_url,
            'fileName': f'airline-{airline_id}-{uuid.uuid4().hex}',
            'folder': '/everfly/airlines/',
            'useUniqueFileName': 'true',
        },
        timeout=12,
    )
    response.raise_for_status()
    result = response.json()
    return {'logo_url': result.get('url'), 'logo_file_id': result.get('fileId')}


def _upload_logo_file_to_imagekit(file_storage, airline_id):
    private_key = os.environ.get('IMAGEKIT_PRIVATE_KEY')
    url_endpoint = os.environ.get('IMAGEKIT_URL_ENDPOINT')
    if not private_key or not url_endpoint:
        raise RuntimeError('ImageKit is required for uploaded logos; use a public URL instead')
    if file_storage.mimetype not in ALLOWED_AIRLINE_LOGO_TYPES:
        raise ValueError('Logo file must be PNG, JPEG, WebP, or SVG')
    content = file_storage.stream.read(MAX_AIRLINE_LOGO_BYTES + 1)
    if len(content) > MAX_AIRLINE_LOGO_BYTES:
        raise ValueError('Logo file must be 1 MB or smaller')
    if not content:
        raise ValueError('Logo file is empty')
    response = requests.post(
        'https://upload.imagekit.io/api/v1/files/upload',
        auth=(private_key, ''),
        files={'file': (file_storage.filename or 'airline-logo', content, file_storage.mimetype)},
        data={
            'fileName': f'airline-{airline_id}-{uuid.uuid4().hex}',
            'folder': '/everfly/airlines/',
            'useUniqueFileName': 'true',
        },
        timeout=20,
    )
    response.raise_for_status()
    result = response.json()
    return {'logo_url': result.get('url'), 'logo_file_id': result.get('fileId')}


@app.route('/api/airlines/<int:id>/logo', methods=['POST'])
@login_required
def update_airline_logo(id):
    airline = query_db("SELECT id FROM airlines WHERE id = ? AND user_id = ?", (id, g.user['id']), one=True)
    if not airline:
        return jsonify({'error': 'Not found'}), 404
    upload = request.files.get('file')
    if upload:
        try:
            imported = _upload_logo_file_to_imagekit(upload, id)
        except ValueError as e:
            return jsonify({'error': str(e)}), 400
        except RuntimeError as e:
            return jsonify({'error': str(e)}), 503
        except Exception as e:
            print(f"ImageKit logo upload failed: {e}")
            return jsonify({'error': 'ImageKit could not upload this logo'}), 502
        execute_db("UPDATE airlines SET logo_url = ?, logo_source_url = NULL, logo_file_id = ? WHERE id = ? AND user_id = ?",
                   (imported.get('logo_url'), imported.get('logo_file_id'), id, g.user['id']))
        return jsonify(query_db("SELECT * FROM airlines WHERE id = ? AND user_id = ?", (id, g.user['id']), one=True))

    try:
        source_url = validate_public_image_url((request.get_json(silent=True) or {}).get('source_url'))
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    imported = None
    try:
        imported = _import_logo_to_imagekit(source_url, id)
    except Exception as e:
        print(f"ImageKit logo import failed: {e}")
    logo_url = imported.get('logo_url') if imported else None
    logo_file_id = imported.get('logo_file_id') if imported else None
    execute_db("UPDATE airlines SET logo_url = ?, logo_source_url = ?, logo_file_id = ? WHERE id = ? AND user_id = ?",
               (logo_url, source_url, logo_file_id, id, g.user['id']))
    return jsonify(query_db("SELECT * FROM airlines WHERE id = ? AND user_id = ?", (id, g.user['id']), one=True))


@app.route('/api/airlines/<int:id>/logo', methods=['DELETE'])
@login_required
def delete_airline_logo(id):
    airline = query_db("SELECT id FROM airlines WHERE id = ? AND user_id = ?", (id, g.user['id']), one=True)
    if not airline:
        return jsonify({'error': 'Not found'}), 404
    execute_db("UPDATE airlines SET logo_url = NULL, logo_source_url = NULL, logo_file_id = NULL WHERE id = ? AND user_id = ?",
               (id, g.user['id']))
    return jsonify({'message': 'Logo removed'})

# --- CSV Import Route ---
import os
import io
import csv
from datetime import datetime
import pytz
import airlines_data

def _calc_duration_minutes(conn, origin_id, dest_id, dep_str, arr_str):
    """Calculate duration in minutes considering timezones."""
    if not dep_str or not arr_str: return None
    try:
        # Get Timezones
        def get_tz(aid):
            cur = conn.execute('''
                SELECT c.timezone FROM airports a 
                JOIN cities c ON a.city_id = c.id 
                WHERE a.id = ? AND a.user_id = ?
            ''', (aid, g.user['id']))
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
            cur = conn.execute(f"SELECT id FROM {table} WHERE {col} = ? AND user_id = ?", (val, g.user['id']))
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
                                    cur_c = conn.execute("SELECT id FROM cities WHERE name = ? AND country_code = ? AND user_id = ?", (city_name, country_code, g.user['id']))
                                    res_c = cur_c.fetchone()
                                    if res_c: normalized_row['city_id'] = res_c[0]
                                    else:
                                        # Create basic city
                                        cur_ins = conn.execute("INSERT INTO cities (user_id, name, country, country_code, timezone) VALUES (?, ?, ?, ?, ?)",
                                                   (g.user['id'], city_name, country_code, country_code, info.get('tz')))
                                        normalized_row['city_id'] = cur_ins.lastrowid

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
                        normalized_row['duration_scheduled'] = _calc_duration_minutes(conn, origin_id, dest_id, std, sta)
                    if atd and ata and not normalized_row.get('duration_actual'):
                        normalized_row['duration_actual'] = _calc_duration_minutes(conn, origin_id, dest_id, atd, ata)

            # 3. Prepare Final Data
            valid_data = {k: v for k, v in normalized_row.items() if k in target_cols}
            
            if not valid_data:
                continue

            valid_data['user_id'] = g.user['id']

            cols = ', '.join(valid_data.keys())
            placeholders = ', '.join(['?'] * len(valid_data))
            values = list(valid_data.values())

            try:
                validate_tenant_relationships(conn, table_name, valid_data, g.user['id'])
                conn.execute(f"INSERT INTO {table_name} ({cols}) VALUES ({placeholders})", values)
                success_count += 1
            except Exception as e:
                errors.append(f"Row {i+1}: {str(e)}")
        
        conn.commit()
        conn.close()
        
        return jsonify({'message': f'Imported {success_count} rows', 'errors': errors})

    except Exception as e:
        return safe_jsonify_error(e)

@app.route('/api/clear/<table_name>', methods=['DELETE'])
@login_required
def clear_table(table_name):
    ALLOWED_TABLES = ['cities', 'airports', 'airlines', 'aircraft_models', 'flights']
    if table_name not in ALLOWED_TABLES:
        return jsonify({'error': 'Invalid table name'}), 400
    
    try:
        conn = database.get_db()
        conn.execute(f"DELETE FROM {table_name} WHERE user_id = ?", (g.user['id'],))
        conn.commit()
        return jsonify({'message': f'{table_name} cleared'})
    except Exception as e:
        return safe_jsonify_error(e)


# --- Automation Logic ---
import airportsdata
import pycountry

def _update_city_fields_logic(city_id, conn, uid, info_country_code=None, info_timezone=None):
    """Helper to fill in missing fields for a city."""
    import pycountry
    import airportsdata

    cur = conn.execute("SELECT name, country, country_code, timezone, continent FROM cities WHERE id = ? AND user_id = ?", (city_id, uid))
    row = cur.fetchone()
    if not row:
        return False, "City not found"
        
    city_name, country, country_code, timezone, continent = row
    
    new_country = country
    new_country_code = country_code
    new_timezone = timezone
    new_continent = continent
    
    # 1. Resolve country and country_code if one is missing
    if not new_country_code and new_country:
        try:
            countries = pycountry.countries.search_fuzzy(new_country)
            if countries:
                new_country_code = countries[0].alpha_2
                new_country = countries[0].name
        except Exception:
            pass
    elif not new_country and new_country_code:
        try:
            c_obj = pycountry.countries.get(alpha_2=new_country_code.upper())
            if not c_obj:
                c_obj = pycountry.countries.get(alpha_3=new_country_code.upper())
            if c_obj:
                new_country = c_obj.name
                new_country_code = c_obj.alpha_2
        except Exception:
            pass
            
    # Fallback to info_country_code if still missing country_code
    if not new_country_code and info_country_code:
        new_country_code = info_country_code
        try:
            c_obj = pycountry.countries.get(alpha_2=new_country_code.upper())
            if c_obj:
                new_country = c_obj.name
        except Exception:
            pass

    # 2. Resolve timezone if missing
    if not new_timezone:
        if info_timezone:
            new_timezone = info_timezone
        elif city_name and new_country_code:
            try:
                ad = airportsdata.load('ICAO')
                for ap in ad.values():
                    if ap.get('city', '').lower() == city_name.lower() and ap.get('country', '').lower() == new_country_code.lower():
                        if ap.get('tz'):
                            new_timezone = ap.get('tz')
                            break
                if not new_timezone:
                    ad_iata = airportsdata.load('IATA')
                    for ap in ad_iata.values():
                        if ap.get('city', '').lower() == city_name.lower() and ap.get('country', '').lower() == new_country_code.lower():
                            if ap.get('tz'):
                                new_timezone = ap.get('tz')
                                break
            except Exception:
                pass
                
    # 3. Resolve continent if missing
    if not new_continent and new_timezone:
        new_continent = get_continent_from_tz(new_timezone)
        
    # Write back any empty fields
    updates = []
    params = []
    
    if (not country or country.strip() == "") and new_country:
        updates.append("country = ?")
        params.append(new_country)
    if (not country_code or country_code.strip() == "") and new_country_code:
        updates.append("country_code = ?")
        params.append(new_country_code)
    if (not timezone or timezone.strip() == "") and new_timezone:
        updates.append("timezone = ?")
        params.append(new_timezone)
    if (not continent or continent.strip() == "") and new_continent:
        updates.append("continent = ?")
        params.append(new_continent)
        
    if updates:
        params.extend([city_id, uid])
        conn.execute(f"UPDATE cities SET {', '.join(updates)} WHERE id = ? AND user_id = ?", params)
        return True, f"Updated fields: {', '.join([u.split(' =')[0] for u in updates])}"
        
    return True, "No empty fields need updating"


def _update_airport_logic(id, conn):
    """Helper to update single airport with robust matching and cross-validation."""
    import airportsdata
    import pycountry

    uid = g.user['id']
    cur = conn.execute("SELECT id, name, iata_code, icao_code, city_id, lat, lon, timezone FROM airports WHERE id = ? AND user_id = ?", (id, uid))
    row = cur.fetchone()
    if not row:
        return False, "Airport not found"
        
    db_name, db_iata, db_icao, db_city_id, db_lat, db_lon, db_tz = row[1], row[2], row[3], row[4], row[5], row[6], row[7]
    
    info = None
    
    # 1. Look up standard airport data and cross-validate if both IATA and ICAO are present
    if db_icao and db_iata:
        ad_icao = airportsdata.load('ICAO')
        ad_iata = airportsdata.load('IATA')
        
        info_icao = ad_icao.get(db_icao.upper())
        info_iata = ad_iata.get(db_iata.upper())
        
        if info_icao and info_iata:
            # Check for mismatch
            if info_icao.get('iata', '').upper() != db_iata.upper() or info_iata.get('icao', '').upper() != db_icao.upper():
                return False, f"IATA与ICAO不匹配: 数据库中为 IATA={db_iata}/ICAO={db_icao}，而标准库中 ICAO={db_icao} 对应 IATA={info_icao.get('iata')}，IATA={db_iata} 对应 ICAO={info_iata.get('icao')}"
            info = info_icao
        elif info_icao:
            if info_icao.get('iata', '').upper() != db_iata.upper():
                return False, f"IATA与ICAO不匹配: 数据库中为 IATA={db_iata}/ICAO={db_icao}，而标准库中 ICAO={db_icao} 对应 IATA={info_icao.get('iata')}"
            info = info_icao
        elif info_iata:
            if info_iata.get('icao', '').upper() != db_icao.upper():
                return False, f"IATA与ICAO不匹配: 数据库中为 IATA={db_iata}/ICAO={db_icao}，而标准库中 IATA={db_iata} 对应 ICAO={info_iata.get('icao')}"
            info = info_iata
        else:
            return False, "标准库中未找到对应的IATA或ICAO机场数据"
    elif db_icao:
        ad_icao = airportsdata.load('ICAO')
        info = ad_icao.get(db_icao.upper())
        if not info:
            return False, f"标准库中找不到 ICAO={db_icao} 的机场数据"
    elif db_iata:
        ad_iata = airportsdata.load('IATA')
        info = ad_iata.get(db_iata.upper())
        if not info:
            return False, f"标准库中找不到 IATA={db_iata} 的机场数据"
    else:
        return False, "IATA与ICAO代码皆为空，无法查询"

    # 2. Process City mapping and cascading updates
    city_name = info.get('city')
    country_code = info.get('country') # 2-letter country code
    tz = info.get('tz')
    
    city_id = db_city_id
    
    if city_name:
        # Match city by name and user_id
        cur = conn.execute("SELECT id FROM cities WHERE name = ? AND user_id = ?", (city_name, uid))
        city_row = cur.fetchone()
        
        if city_row:
            city_id = city_row[0]
        else:
            # Create new city
            country_name = country_code
            try:
                c_obj = pycountry.countries.get(alpha_2=country_code.upper())
                if c_obj:
                    country_name = c_obj.name
            except Exception:
                pass
                
            cur_insert = conn.execute(
                "INSERT INTO cities (user_id, name, country, country_code, timezone, continent) VALUES (?, ?, ?, ?, ?, ?)",
                (uid, city_name, country_name, country_code, tz, get_continent_from_tz(tz))
            )
            city_id = cur_insert.lastrowid
            
        # Update any empty fields in the city record (cascading update)
        _update_city_fields_logic(city_id, conn, uid, info_country_code=country_code, info_timezone=tz)

    # 3. Update empty fields in the airport record
    updates = []
    params = []
    
    if (not db_name or db_name.strip() == "") and info.get('name'):
        updates.append("name = ?")
        params.append(clean_airport_name(info['name']))
    if (not db_iata or db_iata.strip() == "") and info.get('iata'):
        updates.append("iata_code = ?")
        params.append(info['iata'])
    if (not db_icao or db_icao.strip() == "") and info.get('icao'):
        updates.append("icao_code = ?")
        params.append(info['icao'])
    if db_lat is None and info.get('lat') is not None:
        updates.append("lat = ?")
        params.append(info['lat'])
    if db_lon is None and info.get('lon') is not None:
        updates.append("lon = ?")
        params.append(info['lon'])
    if (not db_tz or db_tz.strip() == "") and info.get('tz'):
        updates.append("timezone = ?")
        params.append(info['tz'])
    if not db_city_id and city_id:
        updates.append("city_id = ?")
        params.append(city_id)
        
    if updates:
        params.extend([id, uid])
        conn.execute(f"UPDATE airports SET {', '.join(updates)} WHERE id = ? AND user_id = ?", params)
        return True, [u.split(" =")[0].strip() for u in updates]
        
    return True, []


# --- API Routes for Automation ---
@app.route('/api/airports/<int:id>/update', methods=['POST'])
@login_required
def update_airport(id):
    try:
        conn = database.get_db()
        success, res = _update_airport_logic(id, conn)
        conn.commit()
        if success: return jsonify({'message': 'Updated', 'fields': res})
        else: return jsonify({'error': res}), 400
    except Exception as e:
        return safe_jsonify_error(e)

@app.route('/api/airports/batch_update', methods=['POST'])
@login_required
def batch_update_airports():
    try:
        conn = database.get_db()
        cur = conn.execute("SELECT id FROM airports WHERE ((icao_code IS NULL OR icao_code = '') OR city_id IS NULL) AND user_id = ?", (g.user['id'],))
        ids = [row[0] for row in cur.fetchall()]
        
        count = 0
        for aid in ids:
            success, _ = _update_airport_logic(aid, conn)
            if success: count += 1
            
        conn.commit()
        return jsonify({'message': f'Processed {len(ids)} airports, Updated {count}.'})
    except Exception as e:
        return safe_jsonify_error(e)

def _update_airline_logic(id, conn):
    """Helper to update single airline IATA from ICAO if possible."""
    import airlines_data
    uid = g.user['id']
    cur = conn.execute("SELECT icao_code, iata_code FROM airlines WHERE id = ? AND user_id = ?", (id, uid))
    row = cur.fetchone()
    if not row or not row[0]: return False, "No ICAO code"
    icao, iata = row
    
    # Only complete if IATA code is empty/missing
    if iata and iata.strip():
        return True, "IATA already exists"
        
    icao = icao.upper()
    idata = airlines_data.AIRLINES_ICAO_TO_IATA.get(icao)
    if idata:
        conn.execute("UPDATE airlines SET iata_code = ? WHERE id = ? AND user_id = ?", (idata, id, uid))
        return True, "Updated"
    
    return False, "ICAO code not found in database"

@app.route('/api/airlines/<int:id>/update', methods=['POST'])
@login_required
def update_airline(id):
    try:
        conn = database.get_db()
        success, res = _update_airline_logic(id, conn)
        conn.commit()
        if success: return jsonify({'message': res})
        else: return jsonify({'error': res}), 400
    except Exception as e:
        return safe_jsonify_error(e)

@app.route('/api/airlines/batch_update', methods=['POST'])
@login_required
def batch_update_airlines():
    try:
        conn = database.get_db()
        # Select ALL airlines with an ICAO code to allow correcting wrong IATA codes
        cur = conn.execute("SELECT id FROM airlines WHERE icao_code IS NOT NULL AND icao_code != '' AND user_id = ?", (g.user['id'],))
        ids = [row[0] for row in cur.fetchall()]
        
        count = 0
        for aid in ids:
            # logic already does a lookup and update if found
            success, _ = _update_airline_logic(aid, conn)
            if success: count += 1
            
        conn.commit()
        return jsonify({'message': f'Processed {len(ids)} airlines, Updated {count}.'})
    except Exception as e:
        return safe_jsonify_error(e)

@app.route('/api/cities/<int:id>/update', methods=['POST'])
@login_required
def update_city(id):
    try:
        conn = database.get_db()
        success, res = _update_city_fields_logic(id, conn, g.user['id'])
        conn.commit()
        if success: return jsonify({'message': res})
        else: return jsonify({'error': res}), 400
    except Exception as e:
        return safe_jsonify_error(e)

@app.route('/api/cities/batch_update', methods=['POST'])
@login_required
def batch_update_cities():
    try:
        conn = database.get_db()
        # Find cities that have at least one empty metadata field
        cur = conn.execute("SELECT id FROM cities WHERE (country_code IS NULL OR country_code = '' OR country IS NULL OR country = '' OR timezone IS NULL OR timezone = '' OR continent IS NULL OR continent = '') AND user_id = ?", (g.user['id'],))
        ids = [row[0] for row in cur.fetchall()]
        
        count = 0
        for cid in ids:
            success, _ = _update_city_fields_logic(cid, conn, g.user['id'])
            if success: count += 1
                
        conn.commit()
        return jsonify({'message': f'Processed {len(ids)} cities, Updated {count}.'})
    except Exception as e:
        return safe_jsonify_error(e)

# --- FlightAware AeroAPI Integration ---

def fetch_aeroapi_data(ident, start_str, end_str):
    url = f"https://aeroapi.flightaware.com/aeroapi/flights/{ident}"
    headers = {"x-apikey": _get_user_api_key()}
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

def _timezone_or_utc(tz_name):
    try:
        return pytz.timezone(tz_name) if tz_name else pytz.utc
    except pytz.UnknownTimeZoneError:
        return pytz.utc

def _as_utc(dt):
    if dt.tzinfo is None:
        return pytz.utc.localize(dt)
    return dt.astimezone(pytz.utc)

def build_aeroapi_departure_day_window(f_date, origin_tz_name, now_utc=None):
    origin_tz = _timezone_or_utc(origin_tz_name)
    departure_date = dateutil.parser.parse(f_date).date()
    local_start = origin_tz.localize(datetime.combine(departure_date, time.min))
    local_end = local_start + timedelta(days=1)

    start_utc = local_start.astimezone(pytz.utc)
    end_utc = local_end.astimezone(pytz.utc)

    now_utc = _as_utc(now_utc or datetime.utcnow())
    future_limit = now_utc + timedelta(days=2)
    if end_utc > future_limit:
        end_utc = future_limit
    if end_utc <= start_utc:
        raise ValueError("Flight date exceeds AeroAPI future limit")

    return (
        start_utc.strftime('%Y-%m-%dT%H:%M:%SZ'),
        end_utc.strftime('%Y-%m-%dT%H:%M:%SZ')
    )

def flight_matches_departure_local_date(api_flight, target_date_str, origin_tz_name):
    t_str = api_flight.get('scheduled_out') or api_flight.get('actual_out')
    if not t_str:
        return False

    origin_tz = _timezone_or_utc(origin_tz_name)
    target_date = dateutil.parser.parse(target_date_str).date()
    departure_utc = _as_utc(dateutil.parser.parse(t_str))
    return departure_utc.astimezone(origin_tz).date() == target_date

def _airport_code_set(airport):
    if not airport:
        return set()

    codes = set()
    for key in ('code', 'code_iata', 'code_icao', 'iata_code', 'icao_code'):
        value = airport.get(key)
        if value:
            codes.add(str(value).upper())
    return codes

def _candidate_matches_route(api_flight, origin_codes, dest_codes):
    if not origin_codes or not dest_codes:
        return False

    candidate_origin = _airport_code_set(api_flight.get('origin'))
    candidate_dest = _airport_code_set(api_flight.get('destination'))
    return bool(candidate_origin & origin_codes) and bool(candidate_dest & dest_codes)

def summarize_aeroapi_candidate(index, api_flight):
    origin = api_flight.get('origin') or {}
    dest = api_flight.get('destination') or {}
    return {
        'index': index,
        'ident': api_flight.get('ident'),
        'ident_iata': api_flight.get('ident_iata'),
        'ident_icao': api_flight.get('ident_icao'),
        'operator': api_flight.get('operator'),
        'scheduled_out': api_flight.get('scheduled_out'),
        'actual_out': api_flight.get('actual_out'),
        'scheduled_in': api_flight.get('scheduled_in'),
        'actual_in': api_flight.get('actual_in'),
        'origin_code': origin.get('code'),
        'origin_iata': origin.get('code_iata'),
        'destination_code': dest.get('code'),
        'destination_iata': dest.get('code_iata'),
        'registration': api_flight.get('registration'),
        'route_distance': api_flight.get('route_distance'),
        'terminal_origin': _format_aeroapi_terminal(api_flight.get('terminal_origin')),
        'terminal_destination': _format_aeroapi_terminal(api_flight.get('terminal_destination')),
    }

def select_aeroapi_candidate(raw_flights, f_date, origin_tz_name, existing_std=None,
                             origin_codes=None, dest_codes=None, selected_candidate_index=None):
    origin_codes = {str(c).upper() for c in (origin_codes or set()) if c}
    dest_codes = {str(c).upper() for c in (dest_codes or set()) if c}

    usable = []
    for index, api_flight in enumerate(raw_flights):
        if flight_matches_departure_local_date(api_flight, f_date, origin_tz_name):
            usable.append((index, api_flight))

    if selected_candidate_index is not None:
        try:
            selected_candidate_index = int(selected_candidate_index)
        except (TypeError, ValueError):
            raise ValueError('Invalid AeroAPI candidate selection')
        for index, api_flight in usable:
            if index == selected_candidate_index:
                return {
                    'ambiguous': False,
                    'match': api_flight,
                    'candidate_index': index,
                    'candidates': [summarize_aeroapi_candidate(i, f) for i, f in usable],
                }
        raise ValueError('Invalid AeroAPI candidate selection')

    route_matches = [
        (index, api_flight)
        for index, api_flight in usable
        if _candidate_matches_route(api_flight, origin_codes, dest_codes)
    ]
    if len(route_matches) == 1:
        index, api_flight = route_matches[0]
        return {
            'ambiguous': False,
            'match': api_flight,
            'candidate_index': index,
            'candidates': [summarize_aeroapi_candidate(i, f) for i, f in usable],
        }

    if len(usable) == 1:
        index, api_flight = usable[0]
        return {
            'ambiguous': False,
            'match': api_flight,
            'candidate_index': index,
            'candidates': [summarize_aeroapi_candidate(i, f) for i, f in usable],
        }

    return {
        'ambiguous': len(usable) > 1,
        'match': None,
        'candidate_index': None,
        'candidates': [summarize_aeroapi_candidate(i, f) for i, f in usable],
    }

def _get_airport_codes(conn, airport_id, uid):
    if not airport_id:
        return set()
    row = conn.execute(
        "SELECT iata_code, icao_code FROM airports WHERE id = ? AND user_id = ?",
        (airport_id, uid)
    ).fetchone()
    if not row:
        return set()
    return {str(code).upper() for code in row if code}

def _get_airport_timezone(conn, airport_id, uid):
    if not airport_id:
        return None
    row = conn.execute(
        "SELECT timezone FROM airports WHERE id = ? AND user_id = ?",
        (airport_id, uid)
    ).fetchone()
    return row[0] if row and row[0] else None

def clean_airport_name(name):
    if not name:
        return name

    cleaned = re.sub(r'\s+', ' ', str(name)).strip()
    suffixes = [
        r'\bInternational\s+Airport\b',
        r'\bIntl\.?\s+Airport\b',
        r'\bRegional\s+Airport\b',
        r'\bMunicipal\s+Airport\b',
        r'\bDomestic\s+Airport\b',
        r'\bAirport\b',
        r'\bAirfield\b',
        r'\bAerodrome\b',
    ]

    for suffix in suffixes:
        updated = re.sub(rf'\s*{suffix}\s*$', '', cleaned, flags=re.IGNORECASE).strip()
        if updated != cleaned:
            cleaned = updated
            break

    cleaned = re.sub(r'\s+', ' ', cleaned).strip(' ,-')
    return cleaned or name

def get_or_create_airport(icao, iata, conn):
    uid = g.user['id']
    if not iata and not icao: return None
    # Try by ICAO first
    if icao:
        cur = conn.execute("SELECT id FROM airports WHERE icao_code = ? AND user_id = ?", (icao, uid))
        row = cur.fetchone()
        if row: return row[0]
    
    # Try by IATA
    if iata:
        cur = conn.execute("SELECT id FROM airports WHERE iata_code = ? AND user_id = ?", (iata, uid))
        row = cur.fetchone()
        if row: return row[0]
        
    print(f"Creating new airport: {icao}/{iata}")
    # Create New Airport using airportsdata
    ad = airportsdata.load('ICAO')
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
        cur = conn.execute("SELECT id, timezone, continent FROM cities WHERE name = ? AND user_id = ?", (city_name, uid))
        city_row = cur.fetchone()
        
        if city_row:
            city_id = city_row[0]
            db_tz = city_row[1]
            db_cont = city_row[2]
            new_tz = info.get('tz')
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
                vals.extend([city_id, uid])
                conn.execute(f"UPDATE cities SET {', '.join(updates)} WHERE id = ? AND user_id = ?", vals)
        else:
            tz = info.get('tz')
            cont = get_continent_from_tz(tz)
            country_code = info.get('country')
            country_name = country_code
            try:
                import pycountry
                c_obj = pycountry.countries.get(alpha_2=country_code)
                if c_obj:
                    country_name = c_obj.name
            except:
                pass

            cur = conn.execute("INSERT INTO cities (user_id, name, country, country_code, timezone, continent) VALUES (?, ?, ?, ?, ?, ?)", 
                             (uid, city_name, country_name, country_code, tz, cont))
            city_id = cur.lastrowid
            
        cur = conn.execute('''
            INSERT INTO airports (user_id, city_id, name, iata_code, icao_code, lat, lon, timezone)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (uid, city_id, clean_airport_name(info['name']), info.get('iata'), info.get('icao'), info['lat'], info['lon'], info.get('tz')))
        return cur.lastrowid
    
    return None

def get_or_create_airline(icao, iata, conn):
    uid = g.user['id']
    if not icao: return None 
    cur = conn.execute("SELECT id FROM airlines WHERE icao_code = ? AND user_id = ?", (icao, uid))
    row = cur.fetchone()
    if row: return row[0]
    
    name = icao # Default
    new_iata = iata
    cur = conn.execute("INSERT INTO airlines (user_id, name, iata_code, icao_code) VALUES (?, ?, ?, ?)", (uid, name, new_iata, icao))
    return cur.lastrowid

# --- Calculation API ---
@app.route('/api/calculate_duration', methods=['POST'])
@login_required
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
        cur = conn.execute("SELECT timezone FROM airports WHERE id = ? AND user_id = ?", (origin_id, g.user['id']))
        origin_row = cur.fetchone()
        cur = conn.execute("SELECT timezone FROM airports WHERE id = ? AND user_id = ?", (dest_id, g.user['id']))
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
        return safe_jsonify_error(e)

# --- Stats API ---
@app.route('/api/stats', methods=['GET'])
@login_required
def get_stats():
    conn = database.get_db()
    uid = g.user['id']

    stats = {
        'totals': {},
        'top': {},
        'breakdowns': {}
    }

    # Visited-cities subquery reused as CTE-style inline (MySQL-compatible, no TEMP TABLE)
    _vc_subq = """
        SELECT a.city_id FROM airports a
        WHERE a.user_id = %s AND a.id IN (
            SELECT f.origin_airport_id FROM flights f WHERE f.user_id = %s
            UNION
            SELECT f.dest_airport_id  FROM flights f WHERE f.user_id = %s
        )
    """

    # Totals
    stats['totals']['flights']  = conn.execute("SELECT COUNT(*) FROM flights WHERE user_id = ?", (uid,)).fetchone()[0]
    stats['totals']['airlines'] = conn.execute("SELECT COUNT(DISTINCT airline_id) FROM flights WHERE user_id = ?", (uid,)).fetchone()[0]
    stats['totals']['aircraft'] = conn.execute("""
        SELECT COUNT(DISTINCT CONCAT(am.model, ' ', am.series))
        FROM flights f
        JOIN aircraft_models am ON f.aircraft_model_id = am.id
        WHERE f.user_id = ?
    """, (uid,)).fetchone()[0]
    stats['totals']['routes'] = conn.execute("SELECT COUNT(DISTINCT CONCAT(origin_airport_id, '-', dest_airport_id)) FROM flights WHERE user_id = ?", (uid,)).fetchone()[0]

    stats['totals']['cities'] = conn.execute(
        f"SELECT COUNT(DISTINCT city_id) FROM ({_vc_subq}) AS vc", (uid, uid, uid)
    ).fetchone()[0]
    stats['totals']['countries'] = conn.execute(
        f"SELECT COUNT(DISTINCT c.country) FROM cities c WHERE c.user_id = ? AND c.id IN ({_vc_subq})", (uid, uid, uid, uid)
    ).fetchone()[0]
    stats['totals']['continents'] = conn.execute(
        f"SELECT COUNT(DISTINCT c.continent) FROM cities c WHERE c.user_id = ? AND c.continent IS NOT NULL AND c.id IN ({_vc_subq})", (uid, uid, uid, uid)
    ).fetchone()[0]
    stats['totals']['airports'] = conn.execute("""
        SELECT COUNT(DISTINCT a.id) FROM airports a
        WHERE a.user_id = ? AND a.id IN (
            SELECT origin_airport_id FROM flights WHERE user_id = ?
            UNION
            SELECT dest_airport_id  FROM flights WHERE user_id = ?
        )
    """, (uid, uid, uid)).fetchone()[0]

    # Top Lists Helper
    def get_top(query, params=()):
        return [{'name': r[0], 'count': r[1], 'extra': r[2] if len(r) > 2 else None}
                for r in conn.execute(query, params).fetchall()]

    # Top Continents (Origin + Dest)
    stats['top']['continents'] = get_top("""
        SELECT c.continent, COUNT(*) as cnt
        FROM (
            SELECT origin_airport_id as aid FROM flights WHERE user_id = ?
            UNION ALL
            SELECT dest_airport_id as aid FROM flights WHERE user_id = ?
        ) t
        JOIN airports a ON t.aid = a.id AND a.user_id = ?
        JOIN cities c ON a.city_id = c.id AND c.user_id = ?
        WHERE c.continent IS NOT NULL AND c.continent != ''
        GROUP BY c.continent
        ORDER BY cnt DESC
    """, (uid, uid, uid, uid))

    # Top Countries (Origin + Dest)
    stats['top']['countries'] = get_top("""
        SELECT c.country, COUNT(*) as cnt, c.country_code
        FROM (
            SELECT origin_airport_id as aid FROM flights WHERE user_id = ?
            UNION ALL
            SELECT dest_airport_id as aid FROM flights WHERE user_id = ?
        ) t
        JOIN airports a ON t.aid = a.id AND a.user_id = ?
        JOIN cities c ON a.city_id = c.id AND c.user_id = ?
        GROUP BY c.country, c.country_code
        ORDER BY cnt DESC
    """, (uid, uid, uid, uid))

    # Top Cities (Origin + Dest)
    stats['top']['cities'] = get_top("""
        SELECT c.name, COUNT(*) as cnt, c.country_code
        FROM (
            SELECT origin_airport_id as aid FROM flights WHERE user_id = ?
            UNION ALL
            SELECT dest_airport_id as aid FROM flights WHERE user_id = ?
        ) t
        JOIN airports a ON t.aid = a.id AND a.user_id = ?
        JOIN cities c ON a.city_id = c.id AND c.user_id = ?
        GROUP BY c.id, c.name, c.country_code
        ORDER BY cnt DESC
    """, (uid, uid, uid, uid))

    # Top Airports (Dep + Arr)
    stats['top']['airports'] = get_top("""
        SELECT a.iata_code, COUNT(*) as cnt, a.name
        FROM (
            SELECT origin_airport_id as aid FROM flights WHERE user_id = ?
            UNION ALL
            SELECT dest_airport_id as aid FROM flights WHERE user_id = ?
        ) t
        JOIN airports a ON t.aid = a.id AND a.user_id = ?
        GROUP BY a.iata_code, a.name
        ORDER BY cnt DESC
    """, (uid, uid, uid))

    # Top Routes
    stats['top']['routes'] = get_top("""
        SELECT CONCAT(a1.iata_code, '-', a2.iata_code), COUNT(*) as cnt
        FROM flights f
        JOIN airports a1 ON f.origin_airport_id = a1.id AND a1.user_id = ?
        JOIN airports a2 ON f.dest_airport_id   = a2.id AND a2.user_id = ?
        WHERE f.user_id = ?
        GROUP BY f.origin_airport_id, f.dest_airport_id, a1.iata_code, a2.iata_code
        ORDER BY cnt DESC
    """, (uid, uid, uid))

    # Top Airlines
    stats['top']['airlines'] = get_top("""
        SELECT al.name, COUNT(*) as cnt, al.frequent_flyer_program
        FROM flights f
        JOIN airlines al ON f.airline_id = al.id AND al.user_id = ?
        WHERE f.user_id = ?
        GROUP BY al.id, al.name, al.frequent_flyer_program
        ORDER BY cnt DESC
    """, (uid, uid))

    # Flights by Year (for Chart) — MySQL YEAR() replaces SQLite strftime
    stats['flights_by_year'] = [
        {'year': r[0], 'count': r[1]}
        for r in conn.execute(
            "SELECT YEAR(date) as y, COUNT(*) FROM flights WHERE user_id = ? AND date IS NOT NULL AND date != '' GROUP BY y ORDER BY y ASC",
            (uid,)
        ).fetchall()
    ]

    # Top Aircraft (Model + Series)
    stats['top']['aircraft'] = get_top("""
        SELECT CONCAT(am.model, ' ', am.series), COUNT(*) as cnt, am.manufacturer
        FROM flights f
        JOIN aircraft_models am ON f.aircraft_model_id = am.id AND am.user_id = ?
        WHERE f.user_id = ?
        GROUP BY am.model, am.series, am.manufacturer
        ORDER BY cnt DESC
    """, (uid, uid))

    # Breakdowns
    stats['breakdowns']['alliance'] = {r[0]: r[1] for r in conn.execute("""
        SELECT al.frequent_flyer_program, COUNT(*)
        FROM flights f JOIN airlines al ON f.airline_id = al.id AND al.user_id = ?
        WHERE f.user_id = ? AND al.frequent_flyer_program IS NOT NULL AND al.frequent_flyer_program != ''
        GROUP BY al.frequent_flyer_program
    """, (uid, uid)).fetchall()}

    stats['breakdowns']['manufacturer'] = {r[0]: r[1] for r in conn.execute("""
        SELECT am.manufacturer, COUNT(*)
        FROM flights f JOIN aircraft_models am ON f.aircraft_model_id = am.id AND am.user_id = ?
        WHERE f.user_id = ?
        GROUP BY am.manufacturer
    """, (uid, uid)).fetchall()}

    return jsonify(stats)

# --- Entity Detail APIs ---
def _entity_response(entity_type, entity, stats=None, related=None):
    if not entity:
        return jsonify({'error': 'Not found'}), 404
    return jsonify({'type': entity_type, 'entity': entity, 'stats': stats or {}, 'related': related or {}})


def _related_flights(where_clause, params):
    return query_db(f'''
        SELECT f.id, f.date, f.flight_number, f.airline_id, f.aircraft_model_id,
               f.origin_airport_id, f.dest_airport_id, f.distance, f.duration_actual,
               oa.iata_code AS origin_code, da.iata_code AS dest_code, al.name AS airline_name
        FROM flights f
        LEFT JOIN airports oa ON f.origin_airport_id = oa.id AND oa.user_id = ?
        LEFT JOIN airports da ON f.dest_airport_id = da.id AND da.user_id = ?
        LEFT JOIN airlines al ON f.airline_id = al.id AND al.user_id = ?
        WHERE f.user_id = ? AND ({where_clause})
        ORDER BY f.date DESC LIMIT 50
    ''', params)


@app.route('/api/entities/flights/<int:id>', methods=['GET'])
@login_required
def get_flight_entity(id):
    uid = g.user['id']
    entity = query_db('''
        SELECT f.*, oa.name AS origin_name, oa.iata_code AS origin_code,
               da.name AS dest_name, da.iata_code AS dest_code,
               al.name AS airline_name, al.logo_url AS airline_logo_url,
               al.logo_source_url AS airline_logo_source_url,
               CONCAT(am.manufacturer, ' ', COALESCE(am.name, am.model)) AS aircraft_model
        FROM flights f
        LEFT JOIN airports oa ON f.origin_airport_id = oa.id AND oa.user_id = ?
        LEFT JOIN airports da ON f.dest_airport_id = da.id AND da.user_id = ?
        LEFT JOIN airlines al ON f.airline_id = al.id AND al.user_id = ?
        LEFT JOIN aircraft_models am ON f.aircraft_model_id = am.id AND am.user_id = ?
        WHERE f.id = ? AND f.user_id = ?
    ''', (uid, uid, uid, uid, id, uid), one=True)
    return _entity_response('flights', entity)


@app.route('/api/entities/airlines/<int:id>', methods=['GET'])
@login_required
def get_airline_entity(id):
    uid = g.user['id']
    entity = query_db("SELECT * FROM airlines WHERE id = ? AND user_id = ?", (id, uid), one=True)
    stats = query_db('''SELECT COUNT(*) AS flights, COALESCE(SUM(distance), 0) AS distance,
                        COALESCE(SUM(COALESCE(duration_actual, duration_scheduled)), 0) AS duration
                        FROM flights WHERE airline_id = ? AND user_id = ?''', (id, uid), one=True)
    related = {'flights': _related_flights('f.airline_id = ?', (uid, uid, uid, uid, id))} if entity else {}
    return _entity_response('airlines', entity, stats, related)


@app.route('/api/entities/airports/<int:id>', methods=['GET'])
@login_required
def get_airport_entity(id):
    uid = g.user['id']
    entity = query_db('''SELECT a.*, c.name AS city_name, c.country, c.country_code
                         FROM airports a LEFT JOIN cities c ON a.city_id = c.id AND c.user_id = ?
                         WHERE a.id = ? AND a.user_id = ?''', (uid, id, uid), one=True)
    stats = query_db('''SELECT COUNT(*) AS visits, SUM(origin_airport_id = ?) AS departures,
                        SUM(dest_airport_id = ?) AS arrivals FROM flights
                        WHERE user_id = ? AND (origin_airport_id = ? OR dest_airport_id = ?)''',
                     (id, id, uid, id, id), one=True)
    related = {'flights': _related_flights('f.origin_airport_id = ? OR f.dest_airport_id = ?', (uid, uid, uid, uid, id, id))} if entity else {}
    return _entity_response('airports', entity, stats, related)


@app.route('/api/entities/cities/<int:id>', methods=['GET'])
@login_required
def get_city_entity(id):
    uid = g.user['id']
    entity = query_db("SELECT * FROM cities WHERE id = ? AND user_id = ?", (id, uid), one=True)
    airports = query_db("SELECT * FROM airports WHERE city_id = ? AND user_id = ? ORDER BY name", (id, uid)) if entity else []
    stats = query_db('''SELECT COUNT(*) AS visits FROM flights f
                        LEFT JOIN airports oa ON f.origin_airport_id = oa.id AND oa.user_id = ?
                        LEFT JOIN airports da ON f.dest_airport_id = da.id AND da.user_id = ?
                        WHERE f.user_id = ? AND (oa.city_id = ? OR da.city_id = ?)''', (uid, uid, uid, id, id), one=True)
    flights = _related_flights('EXISTS (SELECT 1 FROM airports ca WHERE ca.user_id = ? AND ca.city_id = ? AND ca.id IN (f.origin_airport_id, f.dest_airport_id))', (uid, uid, uid, uid, uid, id)) if entity else []
    return _entity_response('cities', entity, stats, {'airports': airports, 'flights': flights})


@app.route('/api/entities/aircraft_models/<int:id>', methods=['GET'])
@login_required
def get_aircraft_model_entity(id):
    uid = g.user['id']
    entity = query_db("SELECT * FROM aircraft_models WHERE id = ? AND user_id = ?", (id, uid), one=True)
    stats = query_db('''SELECT COUNT(*) AS flights, COALESCE(SUM(distance), 0) AS distance,
                        COALESCE(SUM(COALESCE(duration_actual, duration_scheduled)), 0) AS duration,
                        COUNT(DISTINCT registration) AS registrations
                        FROM flights WHERE aircraft_model_id = ? AND user_id = ?''', (id, uid), one=True)
    related = {'flights': _related_flights('f.aircraft_model_id = ?', (uid, uid, uid, uid, id))} if entity else {}
    return _entity_response('aircraft_models', entity, stats, related)

# --- End Entity Detail APIs ---

@app.route('/api/flights/detailed', methods=['GET'])
@login_required
def get_detailed_flights():
    conn = database.get_db()
    uid = g.user['id']
    cursor = conn.execute('''
        SELECT f.*,
               oa.iata_code as origin_code, oa.name as origin_name, oa.lat as origin_lat, oa.lon as origin_lon, oa.city_id as origin_city_id,
               da.iata_code as dest_code, da.name as dest_name, da.lat as dest_lat, da.lon as dest_lon, da.city_id as dest_city_id,
               al.name as airline_name, al.iata_code as airline_iata_code, al.icao_code as airline_icao_code,
               al.logo_url as airline_logo_url, al.logo_source_url as airline_logo_source_url,
               CONCAT(am.manufacturer, ' ', COALESCE(am.name, am.model)) as aircraft_model,
               am.manufacturer,
               am.tags_generation as model_tag_generation,
               am.tags_winglets as model_tag_winglets,
               am.tags_config as model_tag_config
        FROM flights f
        LEFT JOIN airports oa ON f.origin_airport_id = oa.id AND oa.user_id = ?
        LEFT JOIN airports da ON f.dest_airport_id = da.id AND da.user_id = ?
        LEFT JOIN airlines al ON f.airline_id = al.id AND al.user_id = ?
        LEFT JOIN aircraft_models am ON f.aircraft_model_id = am.id AND am.user_id = ?
        WHERE f.user_id = ?
        ORDER BY f.date DESC
    ''', (uid, uid, uid, uid, uid))

    flights = []
    col_names = [d[0] for d in cursor.description]

    for row in cursor.fetchall():
        item = dict(zip(col_names, row))
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

    return jsonify(flights)

def update_single_flight_from_aeroapi(flight_id, force=False):
    conn = database.get_db()
    uid = g.user['id']
    cur = conn.execute("SELECT flight_number, date, origin_airport_id, dest_airport_id, std, atd, sta, ata, registration, airline_id, aircraft_model_id, distance, duration_scheduled, duration_actual, origin_terminal, dest_terminal, flight_class FROM flights WHERE id = ? AND user_id = ?", (flight_id, uid))
    flight = cur.fetchone()
    
    if not flight:
        return {'error': 'Flight not found'}
        
    f_num = flight[0]
    f_date = flight[1]
    
    if not f_num or not f_date:
        return {'error': 'Missing flight number or date'}

    # Strategy: Always fetch if forced, OR if missing critical data
    is_missing_data = not (flight[4] and flight[5] and flight[8])
    if not force and not is_missing_data:
        return {'message': 'Skipped, data exists'}
         
    f_num_clean = f_num.replace(' ', '')
    origin_tz_name = _get_airport_timezone(conn, flight[2], uid)

    try:
        start_window, end_window = build_aeroapi_departure_day_window(f_date, origin_tz_name)
    except ValueError as e:
        return {'error': str(e)}
    
    try:
        raw_flights = fetch_aeroapi_data(f_num_clean, start_window, end_window)
    except ValueError as e:
        return {'error': str(e)}
    except Exception as e:
        return {'error': 'API unexpected error'}
    
    if not raw_flights:
        if force: return {'error': 'No data found in AeroAPI'}
        return {'message': 'No data found'}

    selection = select_aeroapi_candidate(
        raw_flights,
        f_date,
        origin_tz_name,
        existing_std=flight[4],
        origin_codes=_get_airport_codes(conn, flight[2], uid),
        dest_codes=_get_airport_codes(conn, flight[3], uid),
    )
    if selection.get('ambiguous'):
        return {
            'ambiguous': True,
            'message': 'Multiple AeroAPI candidates require manual selection',
            'candidates': selection.get('candidates', []),
        }
    best_match = selection.get('match')

    if not best_match:
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

    
    related_fields, related_values = collect_aeroapi_related_updates(best_match, flight, conn, uid)
    update_fields.extend(related_fields)
    update_values.extend(related_values)

    if not update_fields:
        return {'message': 'No new data or data already exists'}
        
    update_values.append(flight_id)
    sql = f"UPDATE flights SET {', '.join(update_fields)} WHERE id = ? AND user_id = ?"
    update_values.append(uid)
    conn.execute(sql, update_values)
    conn.commit()
    
    return {'success': True, 'fields_updated': len(update_fields), 'debug_match': best_match.get('ident')}

def _load_flight_for_aeroapi(conn, uid, flight_id):
    cur = conn.execute("SELECT flight_number, date, origin_airport_id, dest_airport_id, std, atd, sta, ata, registration, airline_id, aircraft_model_id, distance, duration_scheduled, duration_actual, origin_terminal, dest_terminal, flight_class FROM flights WHERE id = ? AND user_id = ?", (flight_id, uid))
    return cur.fetchone()

def _local_aeroapi_values(flight):
    return {
        'std': flight[4],
        'atd': flight[5],
        'sta': flight[6],
        'ata': flight[7],
        'registration': flight[8],
        'distance': flight[11],
        'duration_scheduled': flight[12],
        'duration_actual': flight[13],
        'origin_terminal': flight[14],
        'dest_terminal': flight[15],
        'flight_class': flight[16],
    }

def _format_aeroapi_terminal(t):
    if t and str(t).isdigit():
        return f"T{t}"
    return t

def _resolve_aeroapi_selection_for_flight(flight, conn, uid, selected_candidate_index=None):
    f_num = flight[0]
    f_date = flight[1]

    if not f_num or not f_date:
        raise ValueError('Missing flight number or date')

    origin_tz_name = _get_airport_timezone(conn, flight[2], uid)
    start_window, end_window = build_aeroapi_departure_day_window(f_date, origin_tz_name)
    raw_flights = fetch_aeroapi_data(f_num.replace(' ', ''), start_window, end_window)
    if not raw_flights:
        raise ValueError('No data found in AeroAPI')

    selection = select_aeroapi_candidate(
        raw_flights,
        f_date,
        origin_tz_name,
        existing_std=flight[4],
        origin_codes=_get_airport_codes(conn, flight[2], uid),
        dest_codes=_get_airport_codes(conn, flight[3], uid),
        selected_candidate_index=selected_candidate_index,
    )
    if selection.get('ambiguous'):
        return selection
    if not selection.get('match'):
        raise ValueError('No matching flight in time window')
    return selection

def _find_aeroapi_match_for_flight(flight, conn, uid, selected_candidate_index=None):
    selection = _resolve_aeroapi_selection_for_flight(flight, conn, uid, selected_candidate_index)
    if selection.get('ambiguous'):
        raise ValueError('Multiple AeroAPI candidates require manual selection')
    return selection['match']

def _aeroapi_remote_values(best_match):
    api_std = best_match.get('scheduled_out')
    api_atd = best_match.get('actual_out')
    api_sta = best_match.get('scheduled_in')
    api_ata = best_match.get('actual_in')
    api_origin_tz = best_match.get('origin', {}).get('timezone')
    api_dest_tz = best_match.get('destination', {}).get('timezone')

    def to_local_str(utc_str, tz_name):
        if not utc_str:
            return None
        try:
            dt_utc = dateutil.parser.parse(utc_str)
            if tz_name:
                try:
                    return dt_utc.astimezone(pytz.timezone(tz_name)).strftime('%Y-%m-%d %H:%M:%S')
                except Exception:
                    return dt_utc.strftime('%Y-%m-%d %H:%M:%S')
            return dt_utc.strftime('%Y-%m-%d %H:%M:%S')
        except Exception:
            return utc_str

    dur_sched = None
    if api_std and api_sta:
        try:
            dur_sched = int((dateutil.parser.parse(api_sta) - dateutil.parser.parse(api_std)).total_seconds() / 60)
        except Exception:
            pass

    dur_actual = None
    if api_atd and api_ata:
        try:
            dur_actual = int((dateutil.parser.parse(api_ata) - dateutil.parser.parse(api_atd)).total_seconds() / 60)
        except Exception:
            pass

    api_dist = best_match.get('route_distance')
    if api_dist is not None:
        try:
            api_dist = int(api_dist * 1.60934)
        except Exception:
            pass

    return {
        'std': to_local_str(api_std, api_origin_tz),
        'atd': to_local_str(api_atd, api_origin_tz),
        'sta': to_local_str(api_sta, api_dest_tz),
        'ata': to_local_str(api_ata, api_dest_tz),
        'registration': best_match.get('registration'),
        'distance': api_dist,
        'duration_scheduled': dur_sched,
        'duration_actual': dur_actual,
        'origin_terminal': _format_aeroapi_terminal(best_match.get('terminal_origin')),
        'dest_terminal': _format_aeroapi_terminal(best_match.get('terminal_destination')),
    }

def _ensure_terminal_in_db(conn, uid, airport_id, term):
    if not airport_id or not term:
        return
    cur = conn.execute("SELECT terminals FROM airports WHERE id = ? AND user_id = ?", (airport_id, uid))
    row = cur.fetchone()
    if not row:
        return
    terms_list = [t.strip() for t in (row[0] or '').split(',') if t.strip()]
    if term not in terms_list:
        terms_list.append(term)
        terms_list.sort()
        conn.execute("UPDATE airports SET terminals = ? WHERE id = ? AND user_id = ?", (", ".join(terms_list), airport_id, uid))

def collect_aeroapi_related_updates(best_match, flight, conn, uid):
    update_fields = []
    update_values = []

    api_origin_code = best_match.get('origin', {}).get('code')
    api_dest_code = best_match.get('destination', {}).get('code')
    api_origin_term = _format_aeroapi_terminal(best_match.get('terminal_origin'))
    api_dest_term = _format_aeroapi_terminal(best_match.get('terminal_destination'))

    if api_origin_code:
        aid = get_or_create_airport(api_origin_code, None, conn)
        if aid:
            if not flight[2]:
                update_fields.append("origin_airport_id = ?")
                update_values.append(aid)
            _ensure_terminal_in_db(conn, uid, flight[2] if flight[2] else aid, api_origin_term)

    if api_dest_code:
        aid = get_or_create_airport(api_dest_code, None, conn)
        if aid:
            if not flight[3]:
                update_fields.append("dest_airport_id = ?")
                update_values.append(aid)
            _ensure_terminal_in_db(conn, uid, flight[3] if flight[3] else aid, api_dest_term)

    api_airline = best_match.get('operator')
    if api_airline and not flight[9]:
        al_id = get_or_create_airline(api_airline, None, conn)
        if al_id:
            update_fields.append("airline_id = ?")
            update_values.append(al_id)

    return update_fields, update_values

def build_aeroapi_related_diffs(best_match, flight):
    diffs = []
    origin = best_match.get('origin') or {}
    dest = best_match.get('destination') or {}

    if not flight[2]:
        origin_label = origin.get('code_iata') or origin.get('code')
        if origin_label:
            diffs.append({
                'field': 'origin_airport_id',
                'label': 'Origin Airport',
                'remote': origin_label,
                'status': 'missing',
            })

    if not flight[3]:
        dest_label = dest.get('code_iata') or dest.get('code')
        if dest_label:
            diffs.append({
                'field': 'dest_airport_id',
                'label': 'Destination Airport',
                'remote': dest_label,
                'status': 'missing',
            })

    if not flight[9] and best_match.get('operator'):
        diffs.append({
            'field': 'airline_id',
            'label': 'Airline',
            'remote': best_match.get('operator'),
            'status': 'missing',
        })

    return diffs

def _build_aeroapi_preview(flight_id, selected_candidate_index=None):
    conn = database.get_db()
    uid = g.user['id']
    flight = _load_flight_for_aeroapi(conn, uid, flight_id)
    if not flight:
        return {'error': 'Flight not found'}

    try:
        selection = _resolve_aeroapi_selection_for_flight(flight, conn, uid, selected_candidate_index)
    except ValueError as e:
        return {'error': str(e)}
    if selection.get('ambiguous'):
        return {
            'ambiguous': True,
            'message': 'Multiple AeroAPI candidates require manual selection',
            'candidates': selection.get('candidates', []),
        }

    best_match = selection['match']
    local_values = _local_aeroapi_values(flight)
    remote_values = _aeroapi_remote_values(best_match)
    if _is_empty_value(local_values.get('flight_class')):
        remote_values['flight_class'] = 'Economy'
    return {
        'success': True,
        'debug_match': best_match.get('ident'),
        'candidate_index': selection.get('candidate_index'),
        'local': local_values,
        'remote': remote_values,
        'diffs': build_aeroapi_field_diffs(local_values, remote_values),
        'related_diffs': build_aeroapi_related_diffs(best_match, flight),
        'origin_airport_id': flight[2],
        'dest_airport_id': flight[3],
    }

import pycountry
import traceback

@app.route('/api/flights/<int:flight_id>/update_aeroapi', methods=['POST'])
@login_required
def update_flight_aeroapi(flight_id):
    try:
        result = update_single_flight_from_aeroapi(flight_id, force=True)
        return jsonify(result)
    except Exception as e:
        traceback.print_exc()
        return safe_jsonify_error(e)

@app.route('/api/flights/<int:flight_id>/aeroapi_preview', methods=['POST'])
@login_required
def preview_flight_aeroapi(flight_id):
    try:
        data = request.json or {}
        return jsonify(_build_aeroapi_preview(flight_id, data.get('candidate_index')))
    except Exception as e:
        traceback.print_exc()
        return safe_jsonify_error(e)

@app.route('/api/flights/<int:flight_id>/aeroapi_apply', methods=['POST'])
@login_required
def apply_flight_aeroapi(flight_id):
    try:
        data = request.json or {}
        selected_fields = [
            field for field in data.get('fields', [])
            if field in AEROAPI_CONFIRM_FIELD_NAMES
        ]

        preview = _build_aeroapi_preview(flight_id, data.get('candidate_index'))
        if preview.get('error'):
            return jsonify(preview)

        remote_values = preview['remote']
        update_fields = []
        update_values = []
        for field in selected_fields:
            value = remote_values.get(field)
            if value is not None:
                update_fields.append(f"{field} = ?")
                update_values.append(value)

        conn = database.get_db()
        uid = g.user['id']
        if 'origin_terminal' in selected_fields:
            _ensure_terminal_in_db(conn, uid, preview.get('origin_airport_id'), remote_values.get('origin_terminal'))
        if 'dest_terminal' in selected_fields:
            _ensure_terminal_in_db(conn, uid, preview.get('dest_airport_id'), remote_values.get('dest_terminal'))

        flight = _load_flight_for_aeroapi(conn, uid, flight_id)
        try:
            selection = _resolve_aeroapi_selection_for_flight(flight, conn, uid, data.get('candidate_index'))
        except ValueError as e:
            return {'error': str(e)}
        if selection.get('ambiguous'):
            return {
                'ambiguous': True,
                'message': 'Multiple AeroAPI candidates require manual selection',
                'candidates': selection.get('candidates', []),
            }
        related_fields, related_values = collect_aeroapi_related_updates(selection['match'], flight, conn, uid)
        update_fields.extend(related_fields)
        update_values.extend(related_values)

        if not update_fields:
            return jsonify({'message': 'No selected AeroAPI values available', 'fields_updated': 0})

        update_values.extend([flight_id, uid])
        conn.execute(f"UPDATE flights SET {', '.join(update_fields)} WHERE id = ? AND user_id = ?", update_values)
        conn.commit()
        return jsonify({'success': True, 'fields_updated': len(update_fields), 'fields': selected_fields})
    except Exception as e:
        traceback.print_exc()
        return safe_jsonify_error(e)

@app.route('/api/flights/update_aeroapi_missing', methods=['POST'])
@login_required
def update_missing_flights_aeroapi():
    conn = database.get_db()
    cur = conn.execute('''
        SELECT id FROM flights 
        WHERE (std IS NULL OR atd IS NULL OR registration IS NULL OR registration = '')
        AND flight_number IS NOT NULL AND date IS NOT NULL
        AND user_id = ?
    ''', (g.user['id'],))
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
    debug_mode = os.environ.get('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(debug=debug_mode, port=5000)
