"""Claude Code hook adapter. No grants are inferred from ordinary prompt text.

Table of contents
  shell_tokens / tool_guard: shell entry point and identity checks
  inspection_or_unrelated: early exit without policy storage
  user_command: direct user command handling
  handle: lifecycle events and hook responses
"""

from pathlib import Path
import re
import shlex

from padlock import (Ledger, Refused, Repository, end_turn, has_protection,
                     parser, session)
from operations import readonly, repository_scope
from controls import apply_user_command


SCRIPT = Path(__file__).with_name("padlock.py").resolve()


def shell_tokens(command):
    if any(char in command for char in ("\n", "\r", "`", "$")):
        raise Refused("Use one literal guarded command without substitutions")
    lexer = shlex.shlex(command, posix=True, punctuation_chars=";&|<>()")
    lexer.whitespace_split = True
    lexer.commenters = ""
    tokens = list(lexer)
    # A PowerShell invocation operator before a quoted executable is not a pipeline.
    if tokens[:1] == ["&"]:
        tokens = tokens[1:]
    if any(token and all(c in ";&|<>()" for c in token) for token in tokens):
        raise Refused("Split shell pipelines and compound version-control commands into separate calls")
    return tokens


def tool_guard(event, repo, state):
    name = event.get("tool_name", "")
    tool_input = event.get("tool_input", {})
    if name == "Skill":
        if str(tool_input.get("skill", "")).startswith("padlock:"):
            raise Refused("Padlock policy commands must be invoked by the user, not the agent")
        return
    if name not in {"Bash", "PowerShell"}:
        return
    command = tool_input.get("command", "")
    relevant = re.search(r"(?i)(?:\bgit(?:\.exe)?\b|\bbut(?:\.exe)?\b|padlock\.py)", command)
    if not relevant:
        return
    tokens = shell_tokens(command)
    if not tokens:
        return
    executable = Path(tokens[0]).name.lower().removesuffix(".exe")
    if executable in {"python", "python3"} and len(tokens) > 1 and Path(tokens[1]).resolve() == SCRIPT:
        try:
            args = parser().parse_args(tokens[2:])
        except SystemExit as error:
            raise Refused("Invalid padlock invocation") from error
        if args.command not in {"run", "status", "toggle", "release"}:
            raise Refused("Agents cannot synthesize lifecycle hooks or issue themselves keys")
        actual_repo = Repository(repo.cwd / args.repo)
        if actual_repo.common != repo.common:
            raise Refused("This invocation changes repositories; the current grant does not apply")
        if args.command != "status":
            expected = (event.get("session_id", ""), event.get("prompt_id", ""), event.get("agent_id", ""))
            if (args.session, args.turn, args.agent) != expected or not all(expected[:2]):
                raise Refused("Use the session, prompt, and agent identities supplied by the host")
            if tool_input.get("run_in_background"):
                raise Refused("Run guarded operations in the foreground so their lifetime is observable")
        return
    direct = [executable, *tokens[1:]]
    if executable in {"git", "but"}:
        repository_scope(direct)
        if readonly(direct):
            return
    if has_protection(state):
        raise Refused("Run version-control mutations through padlock.py run; direct or nested commands are not guarded")


def inspection_or_unrelated(event):
    name = event.get("tool_name", "")
    tool_input = event.get("tool_input", {})
    if name == "Skill":
        if str(tool_input.get("skill", "")).startswith("padlock:"):
            raise Refused("Padlock policy commands must be invoked by the user, not the agent")
        return True
    if name not in {"Bash", "PowerShell"}:
        return True
    command = tool_input.get("command", "")
    if not re.search(r"(?i)(?:\bgit(?:\.exe)?\b|\bbut(?:\.exe)?\b|padlock\.py)", command):
        return True
    tokens = shell_tokens(command)
    if not tokens:
        return True
    executable = Path(tokens[0]).name.lower().removesuffix(".exe")
    if executable in {"git", "but"}:
        direct = [executable, *tokens[1:]]
        repository_scope(direct)
        return readonly(direct)
    if executable in {"python", "python3"} and len(tokens) > 1 and Path(tokens[1]).resolve() == SCRIPT:
        try:
            args = parser().parse_args(tokens[2:])
        except SystemExit as error:
            raise Refused("Invalid padlock invocation") from error
        if args.command == "status":
            return True
        if args.command == "run":
            direct = args.argv[1:] if args.argv[:1] == ["--"] else args.argv
            repository_scope(direct)
            return readonly(direct)
    return False


def user_command(event, repo, state):
    if event.get("command_source") != "plugin" or event.get("expansion_type") != "slash_command":
        raise Refused("Policy changes require a directly invoked padlock plugin command")
    action = event["command_name"].removeprefix("padlock:")
    if event.get("agent_id"):
        raise Refused("This adapter grants keys to the invoking session, not background agents")
    return apply_user_command(repo, state, action, event.get("command_args", ""),
                              event["session_id"], event.get("prompt_id"))


def context(event, message):
    import json
    identities = {"session": event.get("session_id"), "turn": event.get("prompt_id"),
                  "agent": event.get("agent_id", "")}
    return {"hookSpecificOutput": {"hookEventName": event["hook_event_name"],
            "additionalContext": message + "\nPadlock host identities: " + json.dumps(identities)
            + "\nGuard script: " + SCRIPT.as_posix()}}


def handle(event):
    event_name = event.get("hook_event_name")
    if event_name == "UserPromptExpansion" and not event.get("command_name", "").startswith("padlock:"):
        return {}
    if event_name == "PreToolUse" and inspection_or_unrelated(event):
        return {}
    if not isinstance(event.get("cwd"), str) or not event.get("session_id"):
        raise Refused("Missing hook working directory or session identity")
    try:
        repo = Repository(event["cwd"])
    except Refused as error:
        if "not a git repository" in str(error).lower() and event_name != "UserPromptExpansion":
            return {}
        raise
    ledger = Ledger(repo.common)
    if event_name == "PreToolUse":
        tool_guard(event, repo, ledger.read())
        return {}
    create = event_name in {"SessionStart", "UserPromptSubmit", "UserPromptExpansion"}
    with ledger.transaction(create=create) as state:
        sid, turn = event["session_id"], event.get("prompt_id")
        if event_name == "SessionStart":
            if event.get("source") != "compact":
                state["sessions"].pop(sid, None)
            session(state, sid)
            return context(event, "Padlock is active. Consult its policy before version-control changes.")
        if event_name == "UserPromptSubmit":
            session(state, sid, turn)
            return context(event, "Padlock turn context; no privilege is inferred from prompt text.")
        if event_name == "UserPromptExpansion":
            return context(event, user_command(event, repo, state))
        if event_name in {"Stop", "StopFailure"}:
            if not event.get("agent_id"):
                end_turn(state, sid, turn)
        elif event_name == "SessionEnd":
            state["sessions"].pop(sid, None)
        return {}
