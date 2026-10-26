import unittest
from sqlalchemy import select
from sqlalchemy.dialects import mssql
from sqlalchemy.schema import CreateTable
from store import configuration, attempts, login_limits


class AzureSQLDialectTests(unittest.TestCase):
    def test_payload_uses_nvarchar_max(self):
        for table in (configuration, attempts):
            ddl = str(CreateTable(table).compile(dialect=mssql.dialect()))
            self.assertIn('NVARCHAR(max)', ddl)
            self.assertNotIn('NTEXT', ddl)

    def test_window_column_is_delimited_in_ddl_and_queries(self):
        ddl = str(CreateTable(login_limits).compile(dialect=mssql.dialect()))
        query = str(select(login_limits.c.window).compile(dialect=mssql.dialect()))
        self.assertIn('[window]', ddl)
        self.assertIn('[window]', query)
