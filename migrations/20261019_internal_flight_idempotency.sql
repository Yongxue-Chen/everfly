CREATE TABLE IF NOT EXISTS internal_flight_requests (
 request_key VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 username VARCHAR(191) NOT NULL,
 payload_hash CHAR(64) NOT NULL,
 flight_id BIGINT NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (request_key, username)
) ENGINE=InnoDB;
