#!/usr/bin/env python3
"""Privacy-sealed entry points over the untouched upstream scripts.

The upstream skill-creator scripts in this directory are byte-for-byte copies
and must stay that way so `sync_upstream.py` can replace them.
Everything the fork adds is layered here:

    python -m scripts.sealed package <skill-dir> [output-dir]
        Runs the privacy scan, then the upstream packager.
        Refuses to package on ERROR findings.

    python -m scripts.sealed run-loop <run_loop.py arguments...>
        Runs the upstream description-optimisation loop with a privacy
        instruction prepended to every prompt sent to Claude.

Exit codes follow the wrapped command; the scan adds exit 1 on findings.
"""

from __future__ import annotations

import sys

from scripts.privacy_scan import main as privacy_scan_main

PRIVACY_INSTRUCTION = (
    "PRIVACY RULE (applies to everything below): do not introduce any person, "
    "organization, company, product, project, repository, domain, or file path "
    "that is not already present in the current description. Trigger phrases "
    "come from the skill's subject, never from a specific person's situation, "
    "employer, or projects, even if the eval queries mention them.\n\n"
)


def package(argv: list[str]) -> int:
    if not argv:
        print("usage: python -m scripts.sealed package <skill-dir> [output-dir]")
        return 2
    from scripts.package_skill import package_skill

    skill_dir = argv[0]
    output_dir = argv[1] if len(argv) > 1 else None
    print("Privacy scan (gate 3)...")
    if privacy_scan_main([skill_dir]) != 0:
        print("Privacy scan found problems. Fix them before packaging.")
        return 1
    print()
    return 0 if package_skill(skill_dir, output_dir) else 1


def run_loop(argv: list[str]) -> int:
    import scripts.improve_description as improver
    import scripts.run_loop as loop

    original_call = improver._call_claude

    def sealed_call(prompt: str, model: str | None, timeout: int = 300) -> str:
        return original_call(PRIVACY_INSTRUCTION + prompt, model, timeout)

    improver._call_claude = sealed_call
    sys.argv = ["run_loop.py", *argv]
    result = loop.main()
    return int(result or 0)


COMMANDS = {"package": package, "run-loop": run_loop}


def main(argv: list[str] | None = None) -> int:
    args = sys.argv[1:] if argv is None else argv
    if not args or args[0] not in COMMANDS:
        print(__doc__)
        return 2
    return COMMANDS[args[0]](args[1:])


if __name__ == "__main__":
    sys.exit(main())
