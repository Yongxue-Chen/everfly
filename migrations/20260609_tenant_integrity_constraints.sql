-- Tenant-integrity migration for existing FlightLog MySQL databases.
-- Back up the database before running. The procedure aborts before any ALTER
-- when orphaned or cross-user relationships are present.

DELIMITER //
CREATE PROCEDURE preflight_tenant_integrity()
BEGIN
    IF EXISTS (
        SELECT 1 FROM cities c LEFT JOIN users u ON u.id = c.user_id
        WHERE u.id IS NULL LIMIT 1
    ) OR EXISTS (
        SELECT 1 FROM airports a LEFT JOIN users u ON u.id = a.user_id
        WHERE u.id IS NULL LIMIT 1
    ) OR EXISTS (
        SELECT 1 FROM airlines a LEFT JOIN users u ON u.id = a.user_id
        WHERE u.id IS NULL LIMIT 1
    ) OR EXISTS (
        SELECT 1 FROM aircraft_models am LEFT JOIN users u ON u.id = am.user_id
        WHERE u.id IS NULL LIMIT 1
    ) OR EXISTS (
        SELECT 1 FROM flights f LEFT JOIN users u ON u.id = f.user_id
        WHERE u.id IS NULL LIMIT 1
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Orphan tenant rows exist';
    END IF;

    IF EXISTS (
        SELECT 1 FROM airports a
        LEFT JOIN cities c ON c.id = a.city_id AND c.user_id = a.user_id
        WHERE a.city_id IS NOT NULL AND c.id IS NULL LIMIT 1
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cross-user or orphan airport.city_id relationships exist';
    END IF;

    IF EXISTS (
        SELECT 1 FROM flights f
        LEFT JOIN airlines al ON al.id = f.airline_id AND al.user_id = f.user_id
        LEFT JOIN aircraft_models am ON am.id = f.aircraft_model_id AND am.user_id = f.user_id
        LEFT JOIN airports oa ON oa.id = f.origin_airport_id AND oa.user_id = f.user_id
        LEFT JOIN airports da ON da.id = f.dest_airport_id AND da.user_id = f.user_id
        WHERE (f.airline_id IS NOT NULL AND al.id IS NULL)
           OR (f.aircraft_model_id IS NOT NULL AND am.id IS NULL)
           OR (f.origin_airport_id IS NOT NULL AND oa.id IS NULL)
           OR (f.dest_airport_id IS NOT NULL AND da.id IS NULL)
        LIMIT 1
    ) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cross-user or orphan flight relationships exist';
    END IF;
END//
DELIMITER ;

CALL preflight_tenant_integrity();
DROP PROCEDURE preflight_tenant_integrity;

ALTER TABLE cities
    ADD UNIQUE KEY uq_cities_id_user (id, user_id),
    ADD CONSTRAINT fk_cities_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT;

ALTER TABLE airports
    ADD UNIQUE KEY uq_airports_id_user (id, user_id),
    ADD INDEX idx_airports_city_user (city_id, user_id),
    ADD CONSTRAINT fk_airports_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_airports_city_tenant FOREIGN KEY (city_id, user_id) REFERENCES cities (id, user_id) ON DELETE RESTRICT;

ALTER TABLE airlines
    ADD UNIQUE KEY uq_airlines_id_user (id, user_id),
    ADD CONSTRAINT fk_airlines_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT;

ALTER TABLE aircraft_models
    ADD UNIQUE KEY uq_aircraft_models_id_user (id, user_id),
    ADD CONSTRAINT fk_aircraft_models_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT;

ALTER TABLE flights
    ADD UNIQUE KEY uq_flights_id_user (id, user_id),
    ADD INDEX idx_flights_airline_user (airline_id, user_id),
    ADD INDEX idx_flights_aircraft_user (aircraft_model_id, user_id),
    ADD INDEX idx_flights_origin_user (origin_airport_id, user_id),
    ADD INDEX idx_flights_dest_user (dest_airport_id, user_id),
    ADD CONSTRAINT fk_flights_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_flights_airline_tenant FOREIGN KEY (airline_id, user_id) REFERENCES airlines (id, user_id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_flights_aircraft_tenant FOREIGN KEY (aircraft_model_id, user_id) REFERENCES aircraft_models (id, user_id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_flights_origin_tenant FOREIGN KEY (origin_airport_id, user_id) REFERENCES airports (id, user_id) ON DELETE RESTRICT,
    ADD CONSTRAINT fk_flights_dest_tenant FOREIGN KEY (dest_airport_id, user_id) REFERENCES airports (id, user_id) ON DELETE RESTRICT;
