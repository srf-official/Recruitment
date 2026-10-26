import copy
import unittest
from scripts.prepare_revision import prepare


class RevisionTests(unittest.TestCase):
    def test_release_rejects_missing_runtime_secrets_before_changing_azure(self):
        with self.assertRaisesRegex(ValueError, 'secret reference'):
            prepare({'properties': {'configuration': {'ingress': {'targetPort': 80}}, 'template': {'containers': [{'image': 'old'}]}}}, 'image', require_runtime=True)

    def test_atomic_update_preserves_environment_and_resource_settings(self):
        current = {"properties": {"configuration": {"ingress": {
            "targetPort": 80, "external": True, "transport": "auto",
        }}, "template": {"revisionSuffix": "old", "containers": [{
            "name": "starter", "image": "old", "resources": {"cpu": 0.25, "memory": "0.5Gi"},
            "env": [{"name": "DB", "secretRef": "db"}],
            "probes": [{"type": "Readiness", "tcpSocket": {"port": 80}}],
        }], "scale": {"rules": [{"name": "http"}], "maxReplicas": 10}}}}
        original = copy.deepcopy(current)
        result = prepare(current, "ghcr.io/srf-official/recruitment:commit")["properties"]
        self.assertEqual(current, original)
        self.assertEqual(result["configuration"]["ingress"]["targetPort"], 8000)
        self.assertFalse(result["configuration"]["ingress"]["allowInsecure"])
        template = result["template"]
        self.assertNotIn("revisionSuffix", template)
        self.assertEqual(template["containers"][0]["env"], original["properties"]["template"]["containers"][0]["env"])
        self.assertEqual(template["containers"][0]["resources"]["cpu"], 0.25)
        self.assertEqual(template["containers"][0]["probes"][0]["tcpSocket"]["port"], 8000)
        self.assertEqual(template["scale"]["maxReplicas"], 2)
        self.assertEqual(template["scale"]["rules"], [{"name": "http"}])

    def test_multi_container_app_requires_review(self):
        with self.assertRaises(ValueError):
            prepare({"properties": {"template": {"containers": [{}, {}]}}}, "image")
