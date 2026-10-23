"""Preserve configuration while changing image and ingress port in one PATCH."""
import copy
import json
import os
from pathlib import Path


def prepare(current, image):
    properties = current["properties"]
    template = copy.deepcopy(properties["template"])
    template.pop("revisionSuffix", None)
    containers = template["containers"]
    if len(containers) != 1:
        raise ValueError("Review deployment logic before deploying a multi-container app")
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
    Path(os.environ["APP_PATCH"]).write_text(json.dumps(prepare(current, os.environ["IMAGE"])))
