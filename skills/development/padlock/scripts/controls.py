"""Shared parsing for explicit user policy controls; this module confers no authority."""

import argparse
import re
import shlex

from padlock import Refused, control

ACTIONS = {"on", "off", "anchor", "unanchor", "sessionkey", "turnkey",
           "masterkey", "release", "status", "rule"}


def apply_user_command(repo, state, action, text, session_id, turn):
    if action not in ACTIONS:
        raise Refused("Unknown padlock command")
    if action == "masterkey":
        request = text.strip()
        if not request:
            turns = 2
        elif re.fullmatch(r"[+-]?[0-9]+(?:\.[0-9]+)?", request):
            if not re.fullmatch(r"[0-9]+", request) or int(request) < 1:
                raise Refused("The master-key turn count must be a positive whole number")
            turns, request = int(request), ""
        else:
            turns = 1
            if request.startswith("-- "):
                request = request[3:].lstrip()
        result = control(state, repo, action, [], session_id, turn, master_turns=turns)
        return result + ("\nCarry out this user's request in this turn:\n" + request if request else "")
    cli = argparse.ArgumentParser(add_help=False, exit_on_error=False)
    cli.add_argument("branch", nargs="?")
    cli.add_argument("--all", action="store_true")
    cli.add_argument("--permanent", action="store_true")
    cli.add_argument("--deny", default="")
    args, extra = cli.parse_known_args(shlex.split(text))
    if extra or (args.branch and args.all):
        raise Refused("Use one exact branch name, omit it for the current branch, or use --all for a key")
    if action == "status":
        if args.branch or args.all or args.permanent or args.deny:
            raise Refused("status takes no arguments")
        return "Read the saved ledger with padlock.py status and summarize active protections and keys."
    if args.all and action not in {"sessionkey", "turnkey", "release"}:
        raise Refused("--all is available for keys and release only")
    if args.permanent and action not in {"on", "off"}:
        raise Refused("--permanent is available with on/off only")
    if args.deny and action != "rule":
        raise Refused("--deny is available with rule only")
    names = ["--all"] if args.all else [args.branch] if args.branch else []
    return control(state, repo, action, names, session_id, turn,
                   permanent=args.permanent, deny=[x for x in args.deny.split(",") if x])
