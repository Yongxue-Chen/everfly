-- Integration support for services that track the same flights.
--   flight_external_refs: which record in another service a flight came from.
--   flight_events:        append-only change feed, read by cursor (id).
--   cancelled_flights:    archive of cancelled flights (full snapshot); the row is
--                         removed from flights so statistics and maps exclude it.
-- Additive only: no existing table or column changes. Safe to re-run.

CREATE TABLE IF NOT EXISTS flight_external_refs (
    id          INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id     INT NOT NULL,
    flight_id   INT NOT NULL,
    service     VARCHAR(40) NOT NULL,
    external_id VARCHAR(160) NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_flight_ext_ref (user_id, service, external_id),
    INDEX idx_flight_ext_ref_flight (user_id, flight_id),
    CONSTRAINT fk_flight_ext_ref_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS flight_events (
    id            BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id       INT NOT NULL,
    flight_id     INT NOT NULL,
    event_type    VARCHAR(40) NOT NULL,
    changes_json  JSON NOT NULL,
    snapshot_json JSON NOT NULL,
    created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_flight_events_user (user_id, id),
    CONSTRAINT fk_flight_events_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cancelled_flights (
    id            INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id       INT NOT NULL,
    flight_id     INT NOT NULL,
    snapshot_json JSON NOT NULL,
    reason        VARCHAR(255) NOT NULL DEFAULT '',
    source        VARCHAR(40) NOT NULL DEFAULT '',
    cancelled_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_cancelled_flights_flight (user_id, flight_id),
    CONSTRAINT fk_cancelled_flights_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
