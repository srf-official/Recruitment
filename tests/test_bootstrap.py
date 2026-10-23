import json
import unittest
from app import application


class BootstrapTests(unittest.TestCase):
    def request(self, path):
        result = {}
        def start_response(status, headers):
            result.update(status=status, headers=dict(headers))
        body = b"".join(application({"PATH_INFO": path}, start_response))
        return result, json.loads(body)

    def test_probe_succeeds_without_claiming_assessment_is_ready(self):
        result, payload = self.request("/healthz")
        self.assertEqual(result["status"], "200 OK")
        self.assertEqual(payload["stage"], "bootstrap")
        self.assertEqual(result["headers"]["Cache-Control"], "no-store")

    def test_candidate_and_admin_routes_are_unavailable(self):
        for path in ("/", "/admin", "/test/example", "/submit"):
            with self.subTest(path=path):
                result, payload = self.request(path)
                self.assertEqual(result["status"], "503 Service Unavailable")
                self.assertIn("not available", payload["message"])


if __name__ == "__main__":
    unittest.main()
