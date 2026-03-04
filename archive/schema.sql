-- Initial Schema
CREATE TABLE IF NOT EXISTS cities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    country TEXT NOT NULL,
    country_code TEXT,
    timezone TEXT NOT NULL,
    continent TEXT
);

CREATE TABLE IF NOT EXISTS airports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    iata_code TEXT NOT NULL UNIQUE,
    icao_code TEXT,
    city_id INTEGER,
    lat REAL,
    lon REAL,
    timezone TEXT,
    terminals TEXT,
    FOREIGN KEY (city_id) REFERENCES cities (id)
);

CREATE TABLE IF NOT EXISTS airlines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    iata_code TEXT,
    icao_code TEXT,
    callsign TEXT,
    country TEXT,
    logo_url TEXT,
    frequent_flyer_program TEXT,
    frequent_flyer_id TEXT,
    alliance TEXT
);

CREATE TABLE IF NOT EXISTS aircraft_models (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    manufacturer TEXT NOT NULL,
    model TEXT NOT NULL,
    series TEXT,
    subtype TEXT,
    tags_generation TEXT,
    tags_engine TEXT,
    tags_winglets TEXT,
    tags_config TEXT,
    name TEXT
);

CREATE TABLE IF NOT EXISTS flights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    flight_number TEXT NOT NULL,
    airline_id INTEGER,
    aircraft_model_id INTEGER,
    origin_airport_id INTEGER,
    dest_airport_id INTEGER,
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
    FOREIGN KEY (airline_id) REFERENCES airlines (id),
    FOREIGN KEY (aircraft_model_id) REFERENCES aircraft_models (id),
    FOREIGN KEY (origin_airport_id) REFERENCES airports (id),
    FOREIGN KEY (dest_airport_id) REFERENCES airports (id)
);
