"""Offline install checks; never write to the real user skills directory."""

from pathlib import Path
import os
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "skills" / "creator-toy-intro"
INSTALL = ROOT / "scripts" / "install-codex.py"


class InstallCodexTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="codex-install-")
        self.addCleanup(self.temp.cleanup)
        self.skills = Path(self.temp.name) / "a directory with spaces" / "skills"
        self.target = self.skills / SOURCE.name

    def run_install(self, *args):
        return subprocess.run(
            [sys.executable, str(INSTALL), "--skills-dir", str(self.skills), *args],
            cwd=self.temp.name, text=True, capture_output=True,
        )

    def test_dry_run_creates_nothing(self):
        result = self.run_install("--dry-run")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(self.skills.exists())

    @unittest.skipIf(os.name == "nt", "Windows uses copy mode")
    def test_link_works_from_another_directory_and_is_idempotent(self):
        for _ in range(2):
            result = self.run_install()
            self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(self.target.is_symlink())
        self.assertEqual(self.target.resolve(), SOURCE)
        self.assertTrue((self.target / "engine/run.mjs").is_file())

    def test_copy_is_complete_and_independent(self):
        result = self.run_install("--copy")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(self.target.is_symlink())
        expected = {p.relative_to(SOURCE) for p in SOURCE.rglob("*") if p.is_file()
                    and not set(p.relative_to(SOURCE).parts) & {"node_modules", "__pycache__"}
                    and p.suffix != ".pyc" and p.name != ".DS_Store"}
        actual = {p.relative_to(self.target) for p in self.target.rglob("*") if p.is_file()}
        self.assertEqual(actual, expected)
        for path in expected:
            self.assertEqual((self.target / path).read_bytes(), (SOURCE / path).read_bytes())
        (self.target / "SKILL.md").write_text("local edit", encoding="utf-8")
        self.assertNotEqual((SOURCE / "SKILL.md").read_text(encoding="utf-8"), "local edit")

    def test_existing_skill_is_not_overwritten(self):
        self.target.mkdir(parents=True)
        marker = self.target / "my-notes.txt"
        marker.write_text("keep me", encoding="utf-8")
        result = self.run_install("--copy")
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(marker.read_text(encoding="utf-8"), "keep me")
        self.assertFalse((self.target / "SKILL.md").exists())

    @unittest.skipIf(os.name == "nt", "Symlink creation may need Windows privileges")
    def test_unrelated_or_broken_symlinks_are_not_replaced(self):
        self.skills.mkdir(parents=True)
        elsewhere = Path(self.temp.name) / "missing"
        self.target.symlink_to(elsewhere, target_is_directory=True)
        result = self.run_install()
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.target.readlink(), elsewhere)

    def test_copy_cannot_recurse_into_source(self):
        result = subprocess.run(
            [sys.executable, str(INSTALL), "--skills-dir", str(SOURCE), "--copy"],
            text=True, capture_output=True,
        )
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((SOURCE / SOURCE.name).exists())

    @unittest.skipIf(os.name == "nt", "ZIP checkouts may not preserve the repo symlink")
    def test_repo_discovery_resolves_the_shared_skill(self):
        discovered = ROOT / ".agents" / "skills" / SOURCE.name
        self.assertTrue(discovered.is_symlink())
        self.assertEqual(discovered.resolve(), SOURCE)


if __name__ == "__main__":
    unittest.main()
