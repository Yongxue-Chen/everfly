import os
import unittest


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def _read(*parts):
    with open(os.path.join(ROOT, *parts), encoding="utf-8") as handle:
        return handle.read()


class ExampleComposeTest(unittest.TestCase):
    """Keeps the public-facing compose example runnable on a clean host.

    This file previously asserted the example joined a specific external
    network, which was wrong twice over: the deployment it claimed to protect
    runs a compose file kept outside this repository, so the assertion proved
    nothing; and requiring an external network made the example fail with
    "declared as external, but could not be found" for anyone who had not
    already created that network by hand.

    Deployment-specific wiring — shared networks, aliases for sibling services —
    belongs in the operator's own compose file, not here.
    """

    def test_example_compose_needs_no_preexisting_resources(self):
        source = _read("docker-compose.example.yml")

        self.assertNotIn(
            "external: true",
            source,
            "docker-compose.example.yml must run on a clean Docker host; it "
            "cannot require a network or volume created out of band",
        )

    def test_example_compose_defines_the_service(self):
        source = _read("docker-compose.example.yml")

        self.assertIn("everfly-app:", source)
        self.assertIn("/api/health", source)
        self.assertIn(".env", source)


class DeployConfigTest(unittest.TestCase):
    """deploy.sh must be usable without editing it.

    Host-specific paths belong in an untracked deploy.env, so that a public
    clone gets working defaults and this repository carries no one machine's
    directory layout.
    """

    def test_deploy_script_has_generic_defaults(self):
        source = _read("deploy.sh")

        self.assertIn('EVERFLY_SRC_DIR:-/opt/everfly', source)
        self.assertIn('EVERFLY_COMPOSE_PROJECT:-everfly', source)
        self.assertNotIn(
            "/opt/1panel/",
            source,
            "deploy.sh must not hardcode one host's compose path; put it in "
            "deploy.env instead",
        )

    def test_deploy_env_example_is_tracked_and_documents_the_knobs(self):
        source = _read("deploy.env.example")

        for var in (
            "EVERFLY_SRC_DIR",
            "EVERFLY_COMPOSE_FILE",
            "EVERFLY_COMPOSE_PROJECT",
            "EVERFLY_CONTAINER",
            "EVERFLY_HEALTH_URL",
            "EVERFLY_HEALTH_TIMEOUT",
        ):
            self.assertIn(var, source, f"deploy.env.example should mention {var}")

    def test_deploy_env_is_not_tracked(self):
        gitignore = _read(".gitignore")
        self.assertIn(
            "deploy.env",
            gitignore,
            "deploy.env holds host-specific paths and must stay untracked",
        )


if __name__ == "__main__":
    unittest.main()
