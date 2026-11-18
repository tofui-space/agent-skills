"""Operator/host controls for runtimes without the Claude Code adapter.

These calls are an explicit-user/host interface, not an authentication boundary.
The host or cooperating agent must enforce the policy in references/portable.md.
"""

import shlex
import uuid

from controls import apply_user_command
from padlock import Refused, end_turn, session


def operate(repo, ledger, args):
    if args.agent:
        raise Refused("Operator controls do not delegate authority to subagents")
    if args.action != "command" and args.arguments:
        raise Refused("Lifecycle operations take no command arguments")
    if args.action == "start" and (args.session or args.turn):
        raise Refused("start allocates fresh identities; do not supply existing ones")
    with ledger.transaction(create=args.action == "start") as state:
        if args.action == "start":
            sid, turn = str(uuid.uuid4()), str(uuid.uuid4())
            session(state, sid, turn)
            return {"session": sid, "turn": turn, "message": "Session started without keys"}
        entry = state["sessions"].get(args.session)
        if not entry or not args.turn or entry["turn"] != args.turn:
            raise Refused("Use this operator session's current identities")
        sid, turn = args.session, args.turn
        if args.action == "next":
            turn = str(uuid.uuid4())
            session(state, sid, turn)
            message = "New turn started; retain these identities in this session only"
        elif args.action == "end":
            end_turn(state, sid, turn)
            message = "Turn ended"
        elif args.action == "close":
            state["sessions"].pop(sid)
            message = "Session closed; all its keys and future turns revoked"
        elif args.action == "command":
            if not entry["active"] or not args.arguments:
                raise Refused("A policy command requires an active turn and an action")
            action, *words = args.arguments
            # Master-key task text is prose. Branch options must preserve argv quoting.
            text = " ".join(words) if action == "masterkey" else shlex.join(words)
            message = apply_user_command(repo, state, action, text, sid, turn)
        else:
            raise Refused("Unknown operator action")
        return {"session": sid, "turn": turn, "message": message}
