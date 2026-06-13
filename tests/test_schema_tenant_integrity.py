import os
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SCHEMA = os.path.join(ROOT, "schema_mysql.sql")
MIGRATION = os.path.join(ROOT, "migrations", "20260609_tenant_integrity_constraints.sql")


class SchemaTenantIntegrityTest(unittest.TestCase):
    def test_clean_schema_has_tenant_aware_relationship_constraints(self):
        with open(SCHEMA, encoding="utf-8") as fh:
            source = fh.read()

        self.assertIn("UNIQUE KEY uq_cities_id_user (id, user_id)", source)
        self.assertIn("FOREIGN KEY (city_id, user_id) REFERENCES cities (id, user_id)", source)
        self.assertIn("FOREIGN KEY (origin_airport_id, user_id) REFERENCES airports (id, user_id)", source)
        self.assertIn("FOREIGN KEY (dest_airport_id, user_id) REFERENCES airports (id, user_id)", source)
        self.assertIn("FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT", source)

    def test_existing_database_migration_preflights_bad_relationships(self):
        self.assertTrue(os.path.exists(MIGRATION))
        with open(MIGRATION, encoding="utf-8") as fh:
            source = fh.read()

        self.assertIn("SIGNAL SQLSTATE '45000'", source)
        self.assertIn("Cross-user or orphan airport.city_id relationships exist", source)
        self.assertIn("Cross-user or orphan flight relationships exist", source)
        self.assertIn("ALTER TABLE flights", source)


if __name__ == "__main__":
    unittest.main()
