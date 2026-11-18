"""Conservative effect classification for direct Git and GitButler argument lists.

Table of contents
  options / repository_scope: accepted argument forms
  readonly: operations that do not change branch policy subjects
  git_effects: Git branch effects
  but_entities / target / stack_refs: GitButler identity resolution
  but_effects: GitButler branch effects
  classify: dispatch
  renamed_branch: protection migration for recognized renames
"""

from padlock import Refused


def options(args, flags=(), values=()):
    positional, found = [], {}
    iterator = iter(args)
    for item in iterator:
        if item == "--":
            positional.extend(iterator)
            break
        key, equal, value = item.partition("=")
        if key in flags and not equal:
            found[key] = True
        elif key in values:
            if not equal:
                value = next(iterator, None)
            if value is None:
                raise Refused("Missing value for " + key)
            if key in found:
                raise Refused("Repeated option: " + key)
            found[key] = value
        elif item.startswith("-"):
            raise Refused("Unsupported option while protection is active: " + item)
        else:
            positional.append(item)
    return positional, found


def repository_scope(argv):
    if len(argv) < 2 or argv[0] not in {"git", "but"} or argv[1].startswith("-"):
        raise Refused("Use an explicit git/but subcommand without global options")
    for arg in argv[2:]:
        if arg in {"-C", "--git-dir", "--work-tree"} or arg.startswith(("--git-dir=", "--work-tree=")):
            raise Refused("Repository overrides are unsupported; run from the intended checkout")


def readonly(argv):
    if len(argv) < 2:
        return False
    tool, command, *args = argv
    if command.startswith("-"):
        return False
    if tool == "git":
        if command in {"status", "diff", "show", "log", "rev-parse", "rev-list",
                       "symbolic-ref", "for-each-ref", "show-ref", "ls-files",
                       "ls-tree", "cat-file", "merge-base", "check-ref-format"}:
            # symbolic-ref and show-ref have mutation forms.
            if command == "symbolic-ref":
                return args in [["HEAD"], ["--quiet", "HEAD"], ["--short", "HEAD"]]
            if command == "show-ref":
                return "--exclude-existing" not in args
            return True
        if command == "config":
            return len(args) == 2 and args[0] in {"--get", "--get-all", "--get-regexp"}
        if command == "branch":
            return not args or (args[0] in {"--list", "-l"} and all(not a.startswith("-") for a in args[1:]))
        return command == "worktree" and args == ["list"]
    return tool == "but" and (command in {"status", "diff", "show"} or (
        command == "branch" and (not args or args[0] in {"list", "show"})) or (
        command == "worktree" and args == ["list"]))


def git_effects(repo, command, args):
    current = lambda: repo.branch()
    if command == "commit":
        _, opts = options(args, flags={"--amend", "--no-edit", "-a", "--all", "--allow-empty",
                                      "--allow-empty-message", "--no-verify", "-n", "--signoff", "-s"},
                          values={"-m", "--message", "-F", "--file", "--fixup", "--author"})
        if repo.git("rev-parse", "--verify", "--quiet", "MERGE_HEAD", optional=True).strip():
            raise Refused("An in-progress merge cannot be classified as an ordinary commit")
        operation = "amend" if "--amend" in opts else "fixup" if "--fixup" in opts else "commit"
        return [(current(), operation)]
    if command == "push":
        positional, opts = options(args, flags={"-f", "--force", "--force-with-lease", "--dry-run",
                                               "--delete", "-d", "--set-upstream", "-u", "--no-verify"})
        if len(positional) < 2:
            raise Refused("Use an explicit remote and branch refspec; implicit/bulk push is unsupported")
        remote, *specs = positional
        if remote not in repo.git("remote").splitlines():
            raise Refused("Use a configured remote name")
        effects = []
        for spec in specs:
            if spec.startswith("+"):
                spec = spec[1:]
            if "--delete" in opts or "-d" in opts:
                if ":" in spec:
                    raise Refused("Use a destination branch name with --delete")
                effects.append((repo.branch(spec, allow_new=True), "delete"))
                effects.append((repo.branch(spec, allow_new=True), "push"))
                continue
            source, colon, destination = spec.partition(":")
            if not source:
                if not destination:
                    raise Refused("Empty push refspec")
                effects.extend([(repo.branch(destination, allow_new=True), op) for op in ("delete", "push")])
                continue
            ref = current() if source == "HEAD" else repo.branch(source)
            if not colon:
                # Git's configured push mapping can rename this destination.
                raise Refused("Specify source:destination so the remote target is unambiguous")
            effects.extend([(ref, "push"), (repo.branch(destination, allow_new=True), "push")])
        return effects
    if command == "pull":
        positional, _ = options(args, flags={"--ff-only", "--rebase", "--no-rebase", "--no-edit"})
        if positional:
            raise Refused("Explicit pull refspecs are unsupported; inspect and use the configured upstream")
        ref = current()
        upstream = repo.git("config", "--get", "branch." + ref.removeprefix("refs/heads/") + ".merge",
                            optional=True).strip()
        if not upstream or "\n" in upstream:
            raise Refused("Pull requires a single configured upstream branch")
        return [(ref, "pull"), (repo.branch(upstream, allow_new=True), "merge")]
    if command == "merge":
        positional, _ = options(args, flags={"--ff-only", "--no-ff", "--squash", "--no-edit", "--no-commit"},
                                values={"-m", "--message"})
        if not positional:
            raise Refused("Name the merge source branches explicitly")
        return [(ref, "merge") for ref in [current(), *[repo.branch(p) for p in positional]]]
    if command in {"rebase", "reset", "cherry-pick", "revert"}:
        raise Refused("This history operation needs a verified effect adapter or a master key")
    if command == "branch":
        positional, opts = options(args, flags={"-d", "-D", "--delete", "-m", "-M", "--move"})
        if any(x in opts for x in ("-d", "-D", "--delete")) and positional:
            return [(repo.branch(p), "delete") for p in positional]
        if any(x in opts for x in ("-m", "-M", "--move")) and len(positional) in {1, 2}:
            old, new = (current(), positional[0]) if len(positional) == 1 else (repo.branch(positional[0]), positional[1])
            # A protected rename would need a coordinated policy migration.
            return [(old, "rename"), (repo.branch(new, allow_new=True), "rename")]
        if not opts and len(positional) in {1, 2}:
            repo.branch(positional[0], allow_new=True)
            if len(positional) == 2:
                repo.branch(positional[1])
            return [(repo.branch(positional[0], allow_new=True), "rewrite")]
    if command in {"switch", "checkout"}:
        positional, opts = options(args, flags={"--detach"}, values={"-c", "-b"})
        if len(positional) > 1 or ("-c" in opts and "-b" in opts):
            raise Refused("Only plain checkout or additive branch creation is supported")
        if positional:
            repo.branch(positional[0])
        if opts.get("-c") or opts.get("-b"):
            return [(repo.branch(opts.get("-c", opts.get("-b")), allow_new=True), "rewrite")]
        if positional or opts.get("-c") or opts.get("-b"):
            return []
    if command == "add":
        return []
    raise Refused("Unsupported Git operation while protection is active: " + command)


def but_entities(repo):
    status = repo.but_status()
    groups = list(status["stacks"]) + list(status.get("worktrees", []))
    entities = []
    for group in groups:
        branches = group.get("branches", [])
        for branch in branches:
            entities.append((branch, branches))
    return entities


def target(repo, entities, value):
    hits = []
    for branch, stack in entities:
        if value in {branch.get("name"), "refs/heads/" + branch["name"], branch.get("cliId")}:
            hits.append((branch, stack, "branch"))
        for commit in branch.get("commits", []):
            if value in {commit.get("cliId"), commit.get("commitId"), commit.get("changeId")}:
                hits.append((branch, stack, "commit"))
    if len(hits) != 1:
        raise Refused("GitButler target is missing or ambiguous: " + str(value))
    return hits[0]


def stack_refs(stack):
    return ["refs/heads/" + b["name"] for b in stack]


def but_effects(repo, command, args):
    if command == "commit":
        _, opts = options(args, flags={"--no-message"}, values={"-b", "--branch", "-m", "--message", "-F", "--file"})
        branch = opts.get("-b", opts.get("--branch"))
        own = repo.branch(branch, allow_new=bool(branch))
        effects = [(own, "commit")]
        if own in repo.refs():
            # Appending to a lower stack branch may cause descendant restacking.
            # A whole-stack superset is conservative across status ordering changes.
            entity, stack, _ = target(repo, but_entities(repo), own)
            effects.extend((ref, "rewrite") for ref in stack_refs(stack) if ref != own)
        return effects
    if command == "amend":
        _, opts = options(args, values={"-t", "--target"})
        value = opts.get("-t", opts.get("--target")) or repo.branch().removeprefix("refs/heads/")
        branch, stack, _ = target(repo, but_entities(repo), value)
        own = "refs/heads/" + branch["name"]
        return [(own, "amend"), *[(r, "rewrite") for r in stack_refs(stack) if r != own]]
    if command == "branch" and args[:1] == ["new"]:
        positional, opts = options(args[1:])
        if len(positional) == 1 and not opts:
            return [(repo.branch(positional[0], allow_new=True), "rewrite")]
    from but_effects import extended_effects
    return extended_effects(repo, command, args)


def classify(repo, argv):
    repository_scope(argv)
    if readonly(argv):
        return []
    tool, command, *args = argv
    return git_effects(repo, command, args) if tool == "git" else but_effects(repo, command, args)


def renamed_branch(repo, argv):
    """Recognize supported renames even during a master-key bypass."""
    if argv[:2] == ["git", "branch"] and any(x in argv for x in ("-m", "-M", "--move")):
        names, _ = options(argv[2:], flags={"-m", "-M", "--move"})
        if len(names) == 1:
            return repo.branch(), repo.branch(names[0], allow_new=True)
        if len(names) == 2:
            return repo.branch(names[0]), repo.branch(names[1], allow_new=True)
        raise Refused("Ambiguous branch rename")
    if argv[:2] == ["but", "reword"]:
        names, opts = options(argv[2:], values={"-m", "--message", "-F", "--file"})
        if len(names) == 1:
            branch, _, kind = target(repo, but_entities(repo), names[0])
            if kind == "commit":
                return None
            old = "refs/heads/" + branch["name"]
            new = opts.get("-m", opts.get("--message"))
            if not new:
                raise Refused("Name a branch rename destination explicitly")
            return old, repo.branch(new, allow_new=True)
    return None
