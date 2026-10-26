"""Preserve configuration while changing image and ingress port in one PATCH."""
import copy
import json
import os
from pathlib import Path


def prepare(current, image, require_runtime=False):
    properties = current["properties"]
    template = copy.deepcopy(properties["template"])
    template.pop("revisionSuffix", None)
    containers = template["containers"]
    if len(containers) != 1:
        raise ValueError("Review deployment logic before deploying a multi-container app")
    if require_runtime:
        env = {entry['name']: entry for entry in containers[0].get('env', [])}
        for name in ('DATABASE_URL', 'ADMIN_PASSWORD_HASH', 'SESSION_SECRET'):
            if not env.get(name, {}).get('secretRef'):
                raise ValueError(f'Configure {name} as a secret reference before deploying this release')
        if env.get('APP_ENV', {}).get('value') != 'production':
            raise ValueError('Configure APP_ENV=production before deployment')
        if not env.get('PUBLIC_ORIGIN', {}).get('value', '').startswith('https://'):
            raise ValueError('Configure the HTTPS PUBLIC_ORIGIN before deployment')
    containers[0]["image"] = image
    ingress = copy.deepcopy(properties["configuration"]["ingress"])
    previous_port = ingress["targetPort"]
    ingress.update(targetPort=8000, allowInsecure=False)
    for probe in containers[0].get("probes", []):
        for field in ("httpGet", "tcpSocket"):
            if probe.get(field, {}).get("port") == previous_port:
                probe[field]["port"] = 8000
    template.setdefault("scale", {}).update(minReplicas=0, maxReplicas=2)
    return {"properties": {"configuration": {"ingress": ingress}, "template": template}}


if __name__ == "__main__":
    current = json.loads(Path(os.environ["APP_CURRENT"]).read_text())
    Path(os.environ["APP_PATCH"]).write_text(json.dumps(prepare(current, os.environ["IMAGE"], require_runtime=True)))
