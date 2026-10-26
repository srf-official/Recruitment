"""Assessment rules shared by HTTP handlers and tests. All timestamps are server UTC ms."""
import copy
import math
import re
import unicodedata

DURATIONS = {"aptitude": 15, "language": 20, "prompt": 30}
FORMATS = {"single", "multiple", "boolean", "ranking", "matching", "text"}


class RuleError(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise RuleError(message)


def clean_text(value, limit, field):
    require(isinstance(value, str) and len(value) <= limit, f"Invalid {field}.")
    require(not re.search(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", value), f"Invalid characters in {field}.")
    return value.strip()


def identifier(value):
    require(isinstance(value, str) and re.fullmatch(r"[A-Za-z0-9_-]{1,100}", value), "Invalid identifier.")
    return value


def questions_validated(items, kind):
    require(kind in DURATIONS and isinstance(items, list) and len(items) <= 200, "Invalid question set.")
    result, ids = [], set()
    for source in items:
        require(isinstance(source, dict), "Invalid question.")
        q = {"id": identifier(source.get("id")), "type": source.get("type")}
        require(q["id"] not in ids, "Question IDs must be unique.")
        ids.add(q["id"])
        require(q["type"] in FORMATS, "Unsupported question type.")
        q["text"] = clean_text(source.get("text"), 100000, "question")
        require(q["text"], "Question text is required.")
        for name in ("context", "source", "referenceAnswer", "reviewNote"):
            if name in source:
                q[name] = clean_text(source[name], 100000, name)
        if "table" in source:
            table = source["table"]
            require(isinstance(table, list) and 1 <= len(table) <= 100, "Invalid shared table.")
            require(all(isinstance(row, list) and 1 <= len(row) <= 20 for row in table), "Invalid table rows.")
            q["table"] = [[clean_text(c, 2000, "table cell") for c in row] for row in table]
        q["options"] = []
        q["key"] = []
        if q["type"] not in {"text", "matching"}:
            options = source.get("options")
            require(isinstance(options, list) and 2 <= len(options) <= 30, "Add at least two options.")
            q["options"] = [clean_text(v, 20000, "option") for v in options]
            require(all(q["options"]), "Options cannot be blank.")
            key = source.get("key", [])
            require(isinstance(key, list) and len(set(key)) == len(key), "Invalid answer key.")
            require(all(type(i) is int and 0 <= i < len(options) for i in key), "Invalid key index.")
            if q["type"] in {"single", "boolean"}:
                require(len(key) <= 1, "Choose one correct answer.")
            if q["type"] == "ranking":
                require(not key or len(key) == len(options), "Ranking key must contain every item.")
            q["key"] = key
        if q["type"] == "matching":
            pairs = source.get("pairs")
            require(isinstance(pairs, list) and 2 <= len(pairs) <= 30, "Add at least two matching pairs.")
            q["pairs"] = [{k: clean_text(p.get(k), 20000, "matching item") for k in ("left", "right")} for p in pairs]
            require(all(p["left"] and p["right"] for p in q["pairs"]), "Matching items cannot be blank.")
            require(len({p["right"] for p in q["pairs"]}) == len(pairs), "Right matching items must be unique.")
        for field, default in (("correctScore", 1), ("wrongScore", 0)):
            v = source.get(field, default)
            require(type(v) in (int, float) and math.isfinite(v) and abs(v) <= 1000, "Invalid marks.")
            require(v >= 0 if field == "correctScore" else v <= 0, "Invalid marks range.")
            q[field] = v
        if kind == "prompt":
            q.update(type="text", options=[], key=[], correctScore=0, wrongScore=0)
        result.append(q)
    return result


def public_questions(questions, match_token=None):
    output = []
    for q in questions:
        public = {k: copy.deepcopy(v) for k, v in q.items() if k not in {"key", "referenceAnswer", "reviewNote", "pairs"}}
        if q['type'] == 'matching':
            require(match_token is not None, 'Matching requires an attempt context.')
            public['leftItems'] = [p['left'] for p in q['pairs']]
            public['rightChoices'] = sorted([{'id': match_token(q['id'], i), 'label': p['right']}
                                              for i, p in enumerate(q['pairs'])], key=lambda p: p['id'])
        output.append(public)
    return output


def responses_validated(questions, responses):
    require(isinstance(responses, dict), "Responses must be an object.")
    lookup = {q["id"]: q for q in questions}
    require(set(responses) <= set(lookup), "Unknown question in responses.")
    output = {}
    for qid, value in responses.items():
        q = lookup[qid]
        if q["type"] == "text":
            output[qid] = clean_text(value, 250000, "answer")
            continue
        require(isinstance(value, list), "Invalid response format.")
        count = len(q.get("pairs", q.get("options", [])))
        if q["type"] == "matching":
            require(len(value) <= count and all(i is None or type(i) is int and 0 <= i < count for i in value), "Invalid match.")
        else:
            require(all(type(i) is int and 0 <= i < count for i in value), "Invalid answer option.")
            require(len(value) == len(set(value)), "Repeated answer option.")
            if q["type"] in {"single", "boolean"}:
                require(len(value) <= 1, "Only one answer is allowed.")
            if q["type"] == "ranking":
                require(not value or len(value) == count, "Rank every item.")
        output[qid] = value
    return output


def answered(q, value):
    if q["type"] == "text":
        return isinstance(value, str) and bool(value.strip())
    return isinstance(value, list) and any(v is not None for v in value)


def grade(questions, attempt):
    total, pending, results = 0, 0, []
    for q in questions:
        value = attempt.get("responses", {}).get(q["id"])
        manual = attempt.get("manualMarks", {}).get(q["id"])
        if manual is not None:
            score, status = manual, "Manually marked"
        elif not answered(q, value):
            score, status = 0, "Unanswered"
        elif q["type"] == "text" or q["type"] != "matching" and not q.get("key"):
            score, status = None, "Needs review"
            pending += 1
        else:
            if q["type"] == "matching":
                correct = value == list(range(len(q["pairs"])))
            elif q["type"] == "ranking":
                correct = value == q["key"]
            else:
                correct = set(value) == set(q["key"])
            score, status = (q["correctScore"], "Correct") if correct else (q["wrongScore"], "Wrong")
        if score is not None:
            total += score
        results.append({"id": q["id"], "score": score, "status": status})
    return {"total": round(total, 6), "pending": pending, "results": results}


def student_key(value):
    return unicodedata.normalize("NFKC", value).casefold()
