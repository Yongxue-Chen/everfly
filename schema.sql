-- Initial Schema
CREATE TABLE IF NOT EXISTS cities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    timezone TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS airports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    iata_code TEXT NOT NULL UNIQUE,
    icao_code TEXT,
    city_id INTEGER,
    lat REAL,
    lon REAL,
    FOREIGN KEY (city_id) REFERENCES cities (id)
);

CREATE TABLE IF NOT EXISTS airlines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    iata_code TEXT,
    frequent_flyer_program TEXT
);

CREATE TABLE IF NOT EXISTS aircraft_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    manufacturer TEXT NOT NULL,
    model TEXT NOT NULL,
    series TEXT,
    subtype TEXT,
    generation TEXT,
    engine_type TEXT,
    winglets TEXT
);

CREATE TABLE IF NOT EXISTS flights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    flight_number TEXT NOT NULL,
    airline_id INTEGER,
    aircraft_model_id INTEGER,
    origin_airport_id INTEGER NOT NULL,
    dest_airport_id INTEGER NOT NULL,
    dep_time_scheduled TEXT,
    arr_time_scheduled TEXT,
    dep_time_actual TEXT,
    arr_time_actual TEXT,
    seat_number TEXT,
    seat_type TEXT,
    flight_class TEXT,
    reason TEXT,
    note TEXT,
    FOREIGN KEY (airline_id) REFERENCES airlines (id),
    FOREIGN KEY (aircraft_model_id) REFERENCES aircraft_models (id),
    FOREIGN KEY (origin_airport_id) REFERENCES airports (id),
    FOREIGN KEY (dest_airport_id) REFERENCES airports (id)
);
