"""Validate editable admin configuration while preserving authoritative test state."""
import copy
import uuid

from domain import DURATIONS, clean_text, identifier, questions_validated, require
from store import now_ms


def opaque_id(value):
    identifier(value)
    try:
        require(uuid.UUID(value).version == 4, "Use random UUID4 identifiers for drives and test links.")
    except ValueError:
        require(False, "Invalid drive or test link identifier.")
    return value


def update_configuration(tx, incoming):
    require(isinstance(incoming, dict), "Invalid configuration.")
    defaults = incoming.get("questionSets")
    require(isinstance(defaults, dict) and set(defaults) == set(DURATIONS), "Provide all three question sections.")
    defaults = {kind: questions_validated(items, kind) for kind, items in defaults.items()}
    drives = incoming.get("drives")
    sessions = incoming.get("sessions")
    require(isinstance(drives, list) and len(drives) <= 2000, "Invalid drives.")
    require(isinstance(sessions, list) and len(sessions) <= 6000, "Invalid tests.")
    old_drives = {d["id"]: d for d in tx.state["drives"]}
    old_tests = {s["id"]: s for s in tx.state["sessions"]}
    output_drives, drive_ids, names = [], set(), set()
    for d in drives:
        require(isinstance(d, dict), "Invalid drive.")
        did = opaque_id(d.get("id"))
        require(did not in drive_ids, "Duplicate drive identifier.")
        drive_ids.add(did)
        name = clean_text(d.get("name"), 120, "drive name")
        require(name and name.casefold() not in names, "Drive names must be unique.")
        names.add(name.casefold())
        old = old_drives.get(did)
        if old and old.get("finishedAt"):
            require(name == old["name"] and d.get("finishedAt"), "Finished drives cannot be reopened.")
        item = {"id": did, "name": name, "createdAt": old["createdAt"] if old else now_ms(),
                "finishedAt": old.get("finishedAt") if old else None}
        if d.get("finishedAt") and not item["finishedAt"]:
            item["finishedAt"] = now_ms()
        sets = d.get("questionSets", {})
        require(isinstance(sets, dict) and set(sets) <= set(DURATIONS), "Invalid drive questions.")
        item["questionSets"] = {kind: questions_validated(qs, kind) for kind, qs in sets.items()}
        output_drives.append(item)
    require(set(old_drives) <= drive_ids, "Existing drives cannot be deleted.")
    output_tests, test_ids, combinations = [], set(), set()
    by_drive = {d["id"]: d for d in output_drives}
    for s in sessions:
        require(isinstance(s, dict), "Invalid test.")
        sid, did, kind = opaque_id(s.get("id")), s.get("driveId"), s.get("type")
        require(sid not in test_ids and did in by_drive and kind in DURATIONS, "Invalid test reference.")
        test_ids.add(sid)
        require((did, kind) not in combinations, "Only one link per test type is allowed in each drive.")
        combinations.add((did, kind))
        old = old_tests.get(sid)
        qs = questions_validated(s.get("questions", []), kind)
        require(qs, "Add questions before generating a test link.")
        if old:
            require(old["driveId"] == did and old["type"] == kind, "A test cannot change drive or type.")
            if tx.all_attempts(sid) or old.get("closedAt"):
                require(qs == old["questions"], "Questions and marking rules lock when the first candidate starts.")
            require(not old.get("closedAt") or s.get("closedAt"), "A finished test cannot reopen.")
            item = copy.deepcopy(old)
            item["questions"] = qs
        else:
            require(not by_drive[did].get("finishedAt"), "Cannot add tests to a finished drive.")
            item = {"id": sid, "driveId": did, "type": kind, "start": now_ms(), "closedAt": None, "questions": qs}
        item["name"] = by_drive[did]["name"] + " · " + {"aptitude": "Aptitude", "language": "Language & Reasoning", "prompt": "Prompt Engineering"}[kind]
        if s.get("closedAt") or by_drive[did].get("finishedAt"):
            tx.stop(item)
        output_tests.append(item)
    require(set(old_tests) <= test_ids, "Existing test links cannot be deleted.")
    tx.state.update(drives=output_drives, sessions=output_tests, questionSets=defaults)
