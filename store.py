"""Durable Azure SQL state. A short row lock serializes starts, stops and submissions.

Candidate data never shares the administrator's editable configuration payload.
"""
import copy
import json
import time
from contextlib import contextmanager

from sqlalchemy import (BigInteger, Column, Integer, MetaData, String, Table,
                        UnicodeText, UniqueConstraint, create_engine, event, select, update)
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError

metadata = MetaData()
configuration = Table("recruitment_configuration", metadata,
                      Column("id", Integer, primary_key=True), Column("version", Integer, nullable=False),
                      Column("payload", UnicodeText, nullable=False))
attempts = Table("recruitment_attempts", metadata,
                 Column("id", String(100), primary_key=True), Column("test_id", String(100), nullable=False, index=True),
                 Column("student_key", String(120), nullable=False), Column("token_hash", String(64), nullable=False),
                 Column("payload", UnicodeText, nullable=False), UniqueConstraint("test_id", "student_key", name="uq_test_student"))
login_limits = Table("recruitment_login_limits", metadata,
                     Column("id", String(64), primary_key=True), Column("window", BigInteger, nullable=False),
                     Column("count", Integer, nullable=False))


def now_ms():
    return int(time.time() * 1000)


def empty_state():
    return {"drives": [], "sessions": [], "questionSets": {"aptitude": [], "language": [], "prompt": []}}


class Store:
    def __init__(self, database_url, testing=False):
        options = {"pool_pre_ping": True}
        if database_url.startswith("sqlite"):
            if not testing:
                raise ValueError("SQLite is allowed only for local development/tests. Production requires Azure SQL.")
            options.update(connect_args={"check_same_thread": False, "timeout": 30})
        else:
            if not database_url.startswith("mssql+pyodbc:"):
                raise ValueError("Use mssql+pyodbc with encrypted Azure SQL connectivity.")
            options.update(pool_size=5, max_overflow=10, pool_timeout=30, pool_recycle=900)
            parsed = make_url(database_url)
            if 'odbc_connect' in parsed.query:
                raise ValueError('Use a hostname URL; raw ODBC connection strings are not accepted.')
            database_url = parsed.update_query_dict({'driver': 'ODBC Driver 18 for SQL Server',
                                                     'Encrypt': 'yes', 'TrustServerCertificate': 'no'})
        self.engine = create_engine(database_url, **options)
        if self.engine.dialect.name == "sqlite":
            @event.listens_for(self.engine, "connect")
            def sqlite_settings(connection, _):
                connection.execute("PRAGMA journal_mode=WAL")
                connection.execute("PRAGMA busy_timeout=30000")

    def initialize(self):
        metadata.create_all(self.engine)
        try:
            with self.engine.begin() as connection:
                if connection.execute(select(configuration.c.id).where(configuration.c.id == 1)).first() is None:
                    connection.execute(configuration.insert().values(id=1, version=0, payload=json.dumps(empty_state())))
        except IntegrityError:
            pass  # Another initializer won the single-row insert.

    @contextmanager
    def transaction(self):
        with self.engine.connect() as connection:
            if self.engine.dialect.name == "sqlite":
                connection.exec_driver_sql("BEGIN IMMEDIATE")
            else:
                connection.begin()
            try:
                query = select(configuration).where(configuration.c.id == 1)
                if self.engine.dialect.name == "mssql":
                    query = query.with_hint(configuration, "WITH (UPDLOCK, HOLDLOCK, ROWLOCK)", dialect_name="mssql")
                row = connection.execute(query).mappings().one()
                tx = Transaction(connection, json.loads(row["payload"]), row["version"])
                yield tx
                tx.flush()
                connection.commit()
            except BaseException:
                connection.rollback()
                raise


class Transaction:
    def __init__(self, connection, state, version):
        self.connection, self.state, self.version = connection, state, version
        self.original = copy.deepcopy(state)
        self.loaded = {}

    def test(self, test_id):
        return next((s for s in self.state["sessions"] if s["id"] == test_id), None)

    def all_attempts(self, test_id):
        rows = self.connection.execute(select(attempts).where(attempts.c.test_id == test_id)).mappings()
        output = []
        for row in rows:
            if row["id"] not in self.loaded:
                self.loaded[row["id"]] = {"data": json.loads(row["payload"]), "row": dict(row)}
            output.append(self.loaded[row["id"]]["data"])
        return output

    def add_attempt(self, test_id, data, key, token_hash):
        self.connection.execute(attempts.insert().values(id=data["id"], test_id=test_id, student_key=key,
                                                       token_hash=token_hash, payload=json.dumps(data)))
        self.loaded[data["id"]] = {"data": data, "row": {"payload": json.dumps(data), "token_hash": token_hash}}

    def expire(self, test_id=None):
        now = now_ms()
        for test in self.state["sessions"]:
            if test_id is not None and test["id"] != test_id:
                continue
            if test.get("closedAt"):
                continue
            candidates = self.all_attempts(test["id"])
            for a in candidates:
                if not a.get("submittedAt") and now >= a["deadline"]:
                    a.update(submittedAt=a["deadline"], reason="timeout")
            if test["type"] == "prompt" and candidates and all(a.get("submittedAt") for a in candidates):
                test.update(closedAt=max(a["submittedAt"] for a in candidates), endReason="all-submitted")

    def stop(self, test):
        self.expire(test["id"])
        if not test.get("closedAt"):
            test["closedAt"] = now_ms()
            test["endReason"] = "admin"
        for a in self.all_attempts(test["id"]):
            if not a.get("submittedAt"):
                a.update(submittedAt=test["closedAt"], reason="admin")

    def export_state(self):
        output = copy.deepcopy(self.state)
        for s in output["sessions"]:
            s["attempts"] = copy.deepcopy(self.all_attempts(s["id"]))
        return output

    def next_version(self):
        return self.version + int(self.state != self.original)

    def flush(self):
        if self.state != self.original:
            self.connection.execute(update(configuration).where(configuration.c.id == 1)
                                    .values(payload=json.dumps(self.state, ensure_ascii=False), version=self.version + 1))
        for aid, entry in self.loaded.items():
            payload = json.dumps(entry["data"], ensure_ascii=False)
            if payload != entry["row"]["payload"]:
                self.connection.execute(update(attempts).where(attempts.c.id == aid).values(payload=payload))
