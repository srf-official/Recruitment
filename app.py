"""Deployment bootstrap. Recruitment functionality is not implemented yet."""
import json


def application(environ, start_response):
    if environ.get("PATH_INFO") == "/healthz":
        status = "200 OK"
        payload = {"status": "ok", "service": "turnb-recruitment", "stage": "bootstrap"}
    else:
        status = "503 Service Unavailable"
        payload = {"message": "The recruitment application is not available yet."}
    body = json.dumps(payload).encode("utf-8")
    start_response(status, [
        ("Content-Type", "application/json; charset=utf-8"),
        ("Content-Length", str(len(body))),
        ("Cache-Control", "no-store"),
        ("X-Content-Type-Options", "nosniff"),
    ])
    return [body]
