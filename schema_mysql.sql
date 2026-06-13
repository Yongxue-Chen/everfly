-- ============================================================
-- FlightLog MySQL Schema
-- Character set: utf8mb4 / utf8mb4_unicode_ci
-- Multi-tenant: all data tables carry user_id
-- ============================================================

-- Shared auth table (one row per registered user)
CREATE TABLE IF NOT EXISTS users (
    id                  INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    username            VARCHAR(255) NOT NULL UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    db_filename         VARCHAR(500),           -- kept for reference only, not used at runtime after Phase 2
    api_key_encrypted   TEXT
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- ---- Per-user data tables (all carry user_id) ---------------

CREATE TABLE IF NOT EXISTS cities (
    id              INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    name            VARCHAR(255) NOT NULL,
    country         VARCHAR(255),
    country_code    VARCHAR(10),
    timezone        VARCHAR(100),
    continent       VARCHAR(50),
    UNIQUE KEY uq_cities_id_user (id, user_id),
    INDEX idx_cities_user (user_id),
    CONSTRAINT fk_cities_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS airports (
    id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    name        VARCHAR(255) NOT NULL,
    iata_code   VARCHAR(10),
    icao_code   VARCHAR(10),
    city_id     INT,
    lat         DECIMAL(10, 6),
    lon         DECIMAL(10, 6),
    timezone    VARCHAR(100),
    terminals   TEXT,
    UNIQUE KEY uq_airports_id_user (id, user_id),
    UNIQUE KEY uq_airport_iata (user_id, iata_code),
    INDEX idx_airports_user (user_id),
    INDEX idx_airports_city_user (city_id, user_id),
    CONSTRAINT fk_airports_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_airports_city_tenant FOREIGN KEY (city_id, user_id) REFERENCES cities (id, user_id) ON DELETE RESTRICT
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS airlines (
    id                      INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id                 INT NOT NULL,
    name                    VARCHAR(255) NOT NULL,
    iata_code               VARCHAR(10),
    icao_code               VARCHAR(10),
    callsign                VARCHAR(100),
    country                 VARCHAR(255),
    logo_url                TEXT,
    logo_source_url         TEXT,
    logo_file_id            VARCHAR(255),
    frequent_flyer_program  VARCHAR(100),
    frequent_flyer_id       VARCHAR(100),
    website_url             TEXT,
    alliance                VARCHAR(100),
    UNIQUE KEY uq_airlines_id_user (id, user_id),
    INDEX idx_airlines_user (user_id),
    CONSTRAINT fk_airlines_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS aircraft_models (
    id              INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id         INT NOT NULL,
    manufacturer    VARCHAR(255) NOT NULL,
    model           VARCHAR(255) NOT NULL,
    series          VARCHAR(100),
    subtype         VARCHAR(100),
    tags_generation TEXT,
    tags_engine     TEXT,
    tags_winglets   TEXT,
    tags_config     TEXT,
    name            VARCHAR(255),
    UNIQUE KEY uq_aircraft_models_id_user (id, user_id),
    INDEX idx_aircraft_user (user_id),
    CONSTRAINT fk_aircraft_models_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS flights (
    id                  INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id             INT NOT NULL,
    date                VARCHAR(20) NOT NULL,
    flight_number       VARCHAR(30) NOT NULL,
    airline_id          INT,
    aircraft_model_id   INT,
    origin_airport_id   INT,
    dest_airport_id     INT,
    dep_time_scheduled  VARCHAR(50),
    arr_time_scheduled  VARCHAR(50),
    dep_time_actual     VARCHAR(50),
    arr_time_actual     VARCHAR(50),
    seat_number         VARCHAR(20),
    seat_type           VARCHAR(20),
    flight_class        VARCHAR(50),
    reason              VARCHAR(255),
    note                TEXT,
    origin_terminal     VARCHAR(50),
    dest_terminal       VARCHAR(50),
    tag_generation      VARCHAR(100),
    tag_winglets        VARCHAR(100),
    tag_config          VARCHAR(100),
    registration        VARCHAR(20),
    distance            INT,
    duration_scheduled  INT,
    duration_actual     INT,
    std                 VARCHAR(50),
    atd                 VARCHAR(50),
    sta                 VARCHAR(50),
    ata                 VARCHAR(50),
    UNIQUE KEY uq_flights_id_user (id, user_id),
    INDEX idx_flights_user (user_id),
    INDEX idx_flights_date (date),
    INDEX idx_flights_airline_user (airline_id, user_id),
    INDEX idx_flights_aircraft_user (aircraft_model_id, user_id),
    INDEX idx_flights_origin_user (origin_airport_id, user_id),
    INDEX idx_flights_dest_user (dest_airport_id, user_id),
    CONSTRAINT fk_flights_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_flights_airline_tenant FOREIGN KEY (airline_id, user_id) REFERENCES airlines (id, user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_flights_aircraft_tenant FOREIGN KEY (aircraft_model_id, user_id) REFERENCES aircraft_models (id, user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_flights_origin_tenant FOREIGN KEY (origin_airport_id, user_id) REFERENCES airports (id, user_id) ON DELETE RESTRICT,
    CONSTRAINT fk_flights_dest_tenant FOREIGN KEY (dest_airport_id, user_id) REFERENCES airports (id, user_id) ON DELETE RESTRICT
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
