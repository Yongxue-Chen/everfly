import os
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def _read(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as handle:
        return handle.read()


class DockerNetworkConfigTest(unittest.TestCase):
    """Guards the everInbox integration.

    everInbox reaches everfly over the shared ``travel-services`` network, at the
    pre-rename hostname ``flightlog-app``. If either goes away, everInbox breaks
    silently — nothing errors, flight drafts just stop arriving.

    This used to assert against ``docker-compose.example.yml``, which was wrong
    twice over: production runs a compose file kept outside this repository (see
    docs/DEPLOYMENT.md), so the assertion proved nothing about the deployment it
    claimed to protect; and it forced the example file to declare an external
    network, which made it fail on any clean Docker host.

    The deployment guide is the only in-repo artefact that can carry this
    requirement, so that is what we pin.
    """

    def test_deployment_guide_documents_shared_network_and_alias(self):
        for doc in ("DEPLOYMENT.md", "DEPLOYMENT.zh-CN.md"):
            source = _read("docs", doc)
            self.assertIn(
                "travel-services",
                source,
                f"{doc} must document the shared network everInbox uses",
            )
            self.assertIn(
                "flightlog-app",
                source,
                f"{doc} must document the backwards-compatibility alias; "
                "dropping it silently breaks everInbox",
            )
            self.assertIn(
                "aliases:",
                source,
                f"{doc} must show the alias attached to the network, not just "
                "mention the name in prose",
            )

    def test_example_compose_is_standalone(self):
        """The public-facing example must run on a clean Docker host.

        An ``external: true`` network here fails with "declared as external, but
        could not be found" for anyone who has not already created it by hand.
        """
        source = _read("docker-compose.example.yml")

        self.assertNotIn(
            "external: true",
            source,
            "docker-compose.example.yml must not require a pre-existing network "
            "or volume; the reference deployment's compose file lives outside "
            "this repository",
        )
        self.assertIn("everfly-app:", source)
        self.assertIn("/api/health", source)


if __name__ == "__main__":
    unittest.main()
