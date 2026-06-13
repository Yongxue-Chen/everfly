-- Add optional ImageKit and source metadata for airline logos.

SET @has_logo_source_url = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'airlines'
      AND COLUMN_NAME = 'logo_source_url'
);
SET @add_logo_source_url = IF(
    @has_logo_source_url = 0,
    'ALTER TABLE airlines ADD COLUMN logo_source_url TEXT',
    'SELECT 1'
);
PREPARE stmt FROM @add_logo_source_url;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_logo_file_id = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'airlines'
      AND COLUMN_NAME = 'logo_file_id'
);
SET @add_logo_file_id = IF(
    @has_logo_file_id = 0,
    'ALTER TABLE airlines ADD COLUMN logo_file_id VARCHAR(255)',
    'SELECT 1'
);
PREPARE stmt FROM @add_logo_file_id;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
