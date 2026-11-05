#!/usr/bin/env python3
"""Install the complete shared skill for local Codex discovery (Python 3.9+)."""

import argparse
import os
from pathlib import Path
import shutil
import sys
import tempfile


SOURCE = Path(__file__).resolve().parents[1] / "skills" / "creator-toy-intro"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--skills-dir", type=Path, default=Path.home() / ".agents" / "skills",
        help="Codex skills directory (default: ~/.agents/skills)",
    )
    parser.add_argument(
        "--copy", action="store_true",
        help="Copy the skill instead of linking it (always used on Windows)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Print the plan without writing files")
    args = parser.parse_args()
    skills_dir = args.skills_dir.expanduser().resolve()
    target = skills_dir / SOURCE.name
    copy = args.copy or os.name == "nt"

    try:
        for required in ("SKILL.md", "agents/openai.yaml", "engine/run.mjs", "references/codex.md"):
            if not (SOURCE / required).is_file():
                raise ValueError("Incomplete source skill: {}".format(SOURCE / required))
        if skills_dir == SOURCE or SOURCE in skills_dir.parents:
            raise ValueError("The installation directory must be outside the source skill")
        if target.is_symlink() and target.resolve() == SOURCE and not copy:
            print("Already linked: {} -> {}".format(target, SOURCE))
            return 0
        if target.exists() or target.is_symlink():
            raise ValueError("Destination already exists; nothing replaced: {}".format(target))
        print("{} {} -> {}".format("Copy" if copy else "Link", SOURCE, target))
        if args.dry_run:
            return 0
        skills_dir.mkdir(parents=True, exist_ok=True)
        if copy:
            # Stage a complete copy before exposing it to skill discovery.
            with tempfile.TemporaryDirectory(prefix=".creator-toy-intro-", dir=skills_dir) as staging:
                staged = Path(staging) / SOURCE.name
                shutil.copytree(SOURCE, staged, ignore=shutil.ignore_patterns(
                    "node_modules", "__pycache__", "*.pyc", ".DS_Store",
                ))
                if target.exists() or target.is_symlink():
                    raise ValueError("Destination appeared during installation: {}".format(target))
                staged.rename(target)
        else:
            target.symlink_to(SOURCE, target_is_directory=True)
        print("Installed. In Codex, invoke $creator-toy-intro; restart Codex if it is not listed.")
        if not copy:
            print("Keep this checkout in place; git pull updates the linked skill.")
        return 0
    except (OSError, ValueError) as error:
        print("Install failed: {}".format(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
