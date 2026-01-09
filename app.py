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
cities_cols = ['name', 'country', 'timezone']
airports_cols = ['name', 'iata_code', 'icao_code', 'city_id', 'lat', 'lon']
airlines_cols = ['name', 'iata_code', 'frequent_flyer_program']
aircraft_cols = ['manufacturer', 'model', 'series', 'subtype', 'generation', 'engine_type', 'winglets']
flights_cols = ['date', 'flight_number', 'airline_id', 'aircraft_model_id', 'origin_airport_id', 'dest_airport_id', 
                'dep_time_scheduled', 'arr_time_scheduled', 'dep_time_actual', 'arr_time_actual', 
                'seat_number', 'seat_type', 'flight_class', 'reason', 'note']

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

        for i, row in enumerate(csv_input):
            # clean row keys
            clean_row = {k.strip(): v for k, v in row.items()}
            
            # --- Auto-Linking Logic ---
            if table_name == 'airports':
                # Lookup City ID by name if city_id missing but name present
                if 'city_id' not in clean_row or not clean_row['city_id']:
                    if 'city_name' in clean_row and clean_row['city_name']:
                        cid = lookup_id('cities', 'name', clean_row['city_name'])
                        if cid: clean_row['city_id'] = cid
                        else: errors.append(f"Row {i+1}: City '{clean_row['city_name']}' not found."); continue

            if table_name == 'flights':
                # Lookup Origin
                if 'origin_airport_id' not in clean_row or not clean_row['origin_airport_id']:
                    code = clean_row.get('origin_code')
                    if code:
                        aid = lookup_id('airports', 'iata_code', code)
                        if aid: clean_row['origin_airport_id'] = aid
                        else: errors.append(f"Row {i+1}: Origin Airport '{code}' not found."); continue
                
                # Lookup Dest
                if 'dest_airport_id' not in clean_row or not clean_row['dest_airport_id']:
                    code = clean_row.get('dest_code')
                    if code:
                        aid = lookup_id('airports', 'iata_code', code)
                        if aid: clean_row['dest_airport_id'] = aid
                        else: errors.append(f"Row {i+1}: Dest Airport '{code}' not found."); continue

                # Lookup Airline
                if 'airline_id' not in clean_row or not clean_row['airline_id']:
                    val = clean_row.get('airline_iata')
                    if val:
                        aid = lookup_id('airlines', 'iata_code', val)
                        if aid: clean_row['airline_id'] = aid
                    
                    # Try name if IATA failed or wasn't provided
                    if 'airline_id' not in clean_row:
                        val = clean_row.get('airline_name')
                        if val:
                            aid = lookup_id('airlines', 'name', val)
                            if aid: clean_row['airline_id'] = aid
                            else: errors.append(f"Row {i+1}: Airline '{val}' not found."); continue
                
                # Lookup Aircraft
                if 'aircraft_model_id' not in clean_row or not clean_row['aircraft_model_id']:
                    val = clean_row.get('aircraft_model')
                    if val:
                        aid = lookup_id('aircraft_models', 'model', val)
                        if aid: clean_row['aircraft_model_id'] = aid
                        else: errors.append(f"Row {i+1}: Aircraft '{val}' not found."); continue

            # prepare data
            valid_data = {k: v for k, v in clean_row.items() if k in target_cols}
            
            if not valid_data:
                continue # skip empty or non-matching rows

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


# --- Special Route for Stats/Map Data if needed ---
@app.route('/api/flights/detailed', methods=['GET'])
def get_flights_detailed():
    # Join tables for full details
    query = """
        SELECT f.*, 
               origin.iata_code as origin_code, origin.lat as origin_lat, origin.lon as origin_lon,
               dest.iata_code as dest_code, dest.lat as dest_lat, dest.lon as dest_lon,
               a.name as airline_name,
               am.model as aircraft_model
        FROM flights f
        LEFT JOIN airports origin ON f.origin_airport_id = origin.id
        LEFT JOIN airports dest ON f.dest_airport_id = dest.id
        LEFT JOIN airlines a ON f.airline_id = a.id
        LEFT JOIN aircraft_models am ON f.aircraft_model_id = am.id
    """
    rows = query_db(query)
    return jsonify(rows)

if __name__ == '__main__':
    # Initialize DB (safe to run multiple times)
    database.init_db()
    app.run(debug=True, port=5000)
