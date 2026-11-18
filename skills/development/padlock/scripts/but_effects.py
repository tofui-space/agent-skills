"""Resolve supported GitButler mutations to branch effects before admission.

Table of contents
  selected / rewrites: named subjects and stack effects
  publishing: push previews and remote branch destinations
  integration_target / workspace_refs: repository-wide integration effects
  extended_effects: publication, integration, deletion, move and history commands
"""

from padlock import Refused
from operations import but_entities, options, stack_refs, target


def selected(repo, entities, value, branch_only=False):
    branch, stack, kind = target(repo, entities, value)
    if branch_only and kind != "branch":
        raise Refused("Use an exact GitButler branch name")
    return "refs/heads/" + branch["name"], stack, kind


def rewrites(stack, excluding=()):
    # Status gives a bounded stack even when empty refs prevent ancestry ordering.
    return [(ref, "rewrite") for ref in stack_refs(stack) if ref not in excluding]


def publishing(repo, entities, value, whole_stack=False):
    gerrit = repo.git("config", "--bool", "--get", "gitbutler.gerritMode", optional=True).strip()
    if gerrit == "true":
        raise Refused("Gerrit review destinations need a separate verified adapter")
    branch, stack, kind = target(repo, entities, value)
    if kind != "branch":
        raise Refused("Publishing requires an exact branch name")
    names = [b["name"] for b in stack] if whole_stack else [branch["name"]]
    effects = []
    for name in names:
        # The vendor's preview resolves ancestors and renamed remote destinations.
        # It may fetch remote-tracking refs but does not push or integrate branches.
        preview = repo.but_json("push", "--dry-run", name)
        rows = preview.get("branches")
        if not isinstance(rows, list) or preview.get("refused"):
            raise Refused("Unsupported or refused GitButler push preview")
        for row in rows:
            source = repo.branch(row["branchName"])
            remote, remote_ref = row["remote"], row["remoteRef"]
            if isinstance(remote_ref, list):
                remote_ref = bytes(remote_ref).decode("utf-8")
            if not isinstance(remote, str) or remote not in repo.git("remote").splitlines():
                raise Refused("Push preview names an unknown remote")
            # A custom fetch mapping can change the meaning of a tracking ref.
            mapping = repo.git("config", "--get-all", "remote." + remote + ".fetch").splitlines()
            expected = "refs/heads/*:refs/remotes/" + remote + "/*"
            if len(mapping) != 1 or mapping[0].lstrip("+") != expected:
                raise Refused("Custom remote fetch mappings need a verified destination adapter")
            prefix = "refs/remotes/" + remote + "/"
            if not isinstance(remote_ref, str) or not remote_ref.startswith(prefix):
                raise Refused("Push preview does not name a supported remote branch")
            destination = repo.branch(remote_ref[len(prefix):], allow_new=True)
            effects.extend([(source, "push"), (destination, "push")])
        # Even an up-to-date requested branch remains subject to push policy.
        effects.append((repo.branch(name), "push"))
    return effects


def integration_target(repo):
    ref = repo.git("config", "--get", "gitbutler.project.targetRef", optional=True).strip()
    if not ref.startswith("refs/heads/") or "\n" in ref:
        raise Refused("GitButler must expose an exact local targetRef before integration")
    own = repo.branch(ref)
    name = own.removeprefix("refs/heads/")
    upstream = repo.git("config", "--get-all", "branch." + name + ".merge", optional=True).splitlines()
    remote = repo.git("config", "--get", "branch." + name + ".remote", optional=True).strip()
    if not upstream and not remote:
        return own, own, False
    if len(upstream) != 1 or not upstream[0].startswith("refs/heads/"):
        raise Refused("GitButler target has no single upstream branch")
    if remote != "." and remote not in repo.git("remote").splitlines():
        raise Refused("GitButler target has no supported upstream remote")
    return own, repo.branch(upstream[0], allow_new=True), remote != "."


def workspace_refs(entities):
    # Includes linked worktrees: pull/merge reconcile them as well as the workspace.
    return sorted({"refs/heads/" + branch["name"] for branch, _ in entities})


def extended_effects(repo, command, args):
    entities = but_entities(repo)
    if command == "push" or (command == "pr" and args[:1] == ["new"]):
        flags = {"--dry-run", "-d", "-f", "--with-force", "--no-hooks", "--no-verify"}
        values = set()
        if command == "pr":
            flags = {"--draft", "--with-force"}
            values = {"-m", "--message", "-F", "--file"}
        names, _ = options(args[1:] if command == "pr" else args, flags=flags, values=values)
        if len(names) != 1:
            raise Refused("Name one exact branch for publishing")
        return publishing(repo, entities, names[0], whole_stack=command == "pr")
    if command == "pull":
        names, opts = options(args, flags={"--check", "-c"})
        if names:
            raise Refused("This pull form takes no branch names")
        if opts:
            return []  # Fetch/check only; no local branch integration.
        own, upstream, _ = integration_target(repo)
        effects = [(own, "pull"), (upstream, "merge")]
        return effects + [(ref, op) for ref in workspace_refs(entities)
                          for op in ("pull", "rebase", "delete")]
    if command == "merge":
        names, _ = options(args, flags={"--yes", "--no-ff", "--ff-only", "--whole-stack"})
        if len(names) != 1:
            raise Refused("Name one branch to merge")
        own, stack, _ = selected(repo, entities, names[0], branch_only=True)
        base, upstream, remote = integration_target(repo)
        effects = [(ref, "merge") for ref in set(stack_refs(stack) + [own, base, upstream])]
        if remote:
            effects.append((upstream, "push"))
        return effects + [(ref, op) for ref in workspace_refs(entities) for op in ("rebase", "delete")]
    if command == "branch" and args[:1] in [["delete"], ["update"]]:
        update = args[0] == "update"
        names, opts = options(args[1:], flags={"--dry-run"} if update else (),
                              values={"-s", "--strategy"} if update else ())
        if not names or (update and len(names) != 1):
            raise Refused("Name the exact branches")
        effects = []
        for name in names:
            hits = [b for b, _ in entities if name in {b["name"], "refs/heads/" + b["name"], b.get("cliId")}]
            if not hits and not update:
                effects.append((repo.branch(name), "delete"))
                continue
            own, stack, _ = selected(repo, entities, name, branch_only=True)
            effects.extend([(own, "pull" if update else "delete"), *rewrites(stack, [own])])
            if update:
                strategy = opts.get("-s", opts.get("--strategy", "pull-rebase"))
                if strategy not in {"pull-rebase", "smart-squash", "merge", "pick-remote"}:
                    raise Refused("Unknown branch integration strategy")
                effects.extend((own, op) for op in ("merge", "rebase", "rewrite"))
                upstream = repo.git("config", "--get", "branch." + own[11:] + ".merge", optional=True).strip()
                if not upstream or "\n" in upstream:
                    raise Refused("Branch update needs one recorded upstream branch")
                effects.append((repo.branch(upstream, allow_new=True), "merge"))
        return effects
    if command == "reword":
        names, opts = options(args, values={"-m", "--message", "-F", "--file"})
        if len(names) != 1:
            raise Refused("Name one branch or commit to reword")
        own, stack, kind = selected(repo, entities, names[0])
        if kind == "commit":
            return [(own, "amend"), *rewrites(stack, [own])]
        new = opts.get("-m", opts.get("--message"))
        if not new:
            raise Refused("Name the branch rename destination with -m")
        return [(own, "rename"), (repo.branch(new, allow_new=True), "rename")]
    if command == "move":
        names, opts = options(args, flags={"--unstack"},
                              values={"-b", "--branch", "--above", "--below"})
        destinations = [opts[k] for k in ("-b", "--branch", "--above", "--below") if k in opts]
        if not names or len(destinations) + int("--unstack" in opts) != 1:
            raise Refused("Use one explicit existing move destination or --unstack")
        subjects = names + destinations
        effects = []
        for name in subjects:
            own, stack, _ = selected(repo, entities, name)
            effects.extend([(own, "move"), *rewrites(stack)])
        return effects
    if command in {"uncommit", "squash"}:
        names, opts = options(args, values={"-t", "--target", "-m", "--message", "-F", "--file"})
        if not names or (command == "squash" and not (opts.get("-t") or opts.get("--target"))):
            raise Refused("Name explicit history sources and the squash destination")
        subjects = names + [opts[k] for k in ("-t", "--target") if k in opts]
        effects = []
        for name in subjects:
            own, stack, kind = selected(repo, entities, name)
            effects.extend(rewrites(stack))
            if kind == "branch":
                effects.append((own, "delete"))
        return effects
    raise Refused("Unsupported GitButler command form; inspect its effects before adding an adapter: " + command)
