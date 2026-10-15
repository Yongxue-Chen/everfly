import copy
import unittest
from scripts.migrate_bilingual_names import apply_plan


class FakeConnection:
    def __init__(self):
        self.row = {'name': '北京'}
        self.committed = False
        self.rolled_back = False

    def cursor(self):
        return self

    def execute(self, sql, args):
        if sql.startswith('UPDATE'):
            self.row['name'] = args[0]

    def fetchone(self):
        return self.row.copy()

    def commit(self):
        self.committed = True

    def rollback(self):
        self.rolled_back = True


class BilingualMigrationTest(unittest.TestCase):
    def setUp(self):
        self.plan = {'version': 1, 'user_id': 1, 'changes': [
            {'table': 'cities', 'id': 7, 'before': {'name': '北京'}, 'after': {'name': 'Beijing (北京)'}}
        ]}

    def test_apply_and_rollback_preserve_identifiers(self):
        conn = FakeConnection()
        original = copy.deepcopy(self.plan)
        apply_plan(conn, self.plan, 1)
        self.assertTrue(conn.committed)
        self.assertEqual(conn.row['name'], 'Beijing (北京)')
        apply_plan(conn, self.plan, 1, rollback=True)
        self.assertEqual(conn.row['name'], '北京')
        self.assertEqual(self.plan, original)

    def test_concurrent_edit_is_not_overwritten(self):
        conn = FakeConnection()
        conn.row['name'] = 'User edited name'
        with self.assertRaises(ValueError):
            apply_plan(conn, self.plan, 1)
        self.assertTrue(conn.rolled_back)
        self.assertFalse(conn.committed)

    def test_wrong_tenant_and_unrelated_fields_rejected(self):
        with self.assertRaises(ValueError):
            apply_plan(FakeConnection(), self.plan, 2)
        self.plan['changes'][0]['after']['user_id'] = 2
        with self.assertRaises(ValueError):
            apply_plan(FakeConnection(), self.plan, 1)
