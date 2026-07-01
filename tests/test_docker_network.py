import os
import re
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


class DockerNetworkConfigTest(unittest.TestCase):
    def test_compose_joins_shared_travel_services_network(self):
        with open(os.path.join(ROOT, "docker-compose.example.yml"), encoding="utf-8") as handle:
            source = handle.read()

        self.assertRegex(source, r"networks:\s+- travel-services")
        self.assertRegex(
            source,
            r"travel-services:\s+name: [$][{]TRAVEL_SERVICES_NETWORK:-travel-services[}]\s+external: true",
        )


if __name__ == "__main__":
    unittest.main()
