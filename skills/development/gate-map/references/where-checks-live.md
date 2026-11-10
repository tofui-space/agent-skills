# Where checks live, and what their failure does

## Contents

- Part 1 — Search list
  - CI and build
  - Deploy and startup
  - Runtime
  - Signs that a gate is soft
- Part 2 — Verified failure behaviour
  - GitHub Actions
  - Docker Compose
  - Kubernetes

Two parts. Part 1 is a search list: places where projects commonly define checks, by stage. It is a starting point for finding files, not a statement of what any file does; read each file found. Part 2 is the failure behaviour of common gate mechanisms, each verified against the linked documentation. For a mechanism not listed in part 2, look up its documentation before recording its effect, and cite the page in the report.

## Part 1 — Search list

### CI and build

- CI definitions: `.github/workflows/*.yml`, `.gitlab-ci.yml` and the files it includes, `.circleci/config.yml`, `azure-pipelines.yml`, `Jenkinsfile`, `bitbucket-pipelines.yml`, `.buildkite/`, `.drone.yml`, `.woodpecker/`, `.forgejo/workflows/`.
- Reusable or included CI pieces: local actions under `.github/actions/`, `include:` targets, templates called by `uses:`.
- Task runners that CI calls: `Makefile`, `justfile`, `Taskfile.yml`, `package.json` scripts (including `pre*` and `post*` scripts; whether those run automatically differs between package managers and versions, so check the documentation of the one the project uses), `pyproject.toml` tool sections, `tox.ini`, `noxfile.py`, `Rakefile`, Gradle and Maven build files.
- Build configuration that can turn errors into warnings: compiler and bundler config files, framework config files with options that skip typecheck or lint during build. Read the option's documentation before recording its effect.
- Container builds: `Dockerfile*`, `Containerfile*`, `docker-bake.hcl`. In a multi-stage build, check whether a stage that runs tests or checks is one the built target depends on; look up in the builder's documentation whether stages the target does not depend on are built at all.
- Ownership and review gates that live in the repository: `CODEOWNERS`. Whether review is required lives outside the repository.

### Deploy and startup

- Compose files: `compose.yaml`, `compose.yml`, `docker-compose*.yml`, including `depends_on`, `healthcheck`, `restart`, and one-shot services such as migration runners.
- Kubernetes and Helm: Deployment, StatefulSet, Job and CronJob manifests; `initContainers`; probes; Helm chart templates and hook annotations; Kustomize overlays that patch any of these.
- Platform and release config: `Procfile`, `app.json`, `fly.toml`, `render.yaml`, `railway.json`, `vercel.json`, `netlify.toml`, `app.yaml`, `serverless.yml`, Terraform or Pulumi definitions of services and health checks. Many platforms have a release or pre-deploy command; read the platform's documentation for what its failure stops.
- Entrypoints and start scripts: the `ENTRYPOINT` and `CMD` of the image, every script they call (`entrypoint.sh`, `docker-entrypoint.sh`, `bin/*`, `scripts/*`), and the process manager config if one is used.
- Migration tooling: the migrations directory and the command that applies it; any code that applies migrations from inside the application at startup.

### Runtime

- The application's main function or server bootstrap, up to the call that starts listening: config loading, env validation, connection setup, migration or schema checks, plugin registration.
- Health, readiness and status endpoints: what they actually query.
- Middleware and request guards, lazy initialisers (`getX()` that connects on first call), feature-flag checks that disable code paths.

### Signs that a gate is soft

Look for these near every check; each one can turn a failure into `logged only` or `nothing`:

- shell: `|| true`, `|| echo`, `; true`, `set +e`, a script without `set -e` (or equivalent) where a later command's success hides an earlier failure, a pipeline whose exit status is only the last command's (no `pipefail`), output redirected and exit code never read;
- CI: `continue-on-error`, `allow_failure`, `if: always()` on a step that is meant to gate, a job that nothing downstream `needs`;
- code: `catch` blocks that log and continue, a startup check wrapped in a retry with no final failure, a warning instead of an exit.

## Part 2 — Verified failure behaviour

Verified on 2026-10-23 against the linked pages. When the project pins an older version of a tool, check that version's documentation.

### GitHub Actions

- `jobs.<job_id>.steps[*].continue-on-error: true` lets the job pass when that step fails. `jobs.<job_id>.continue-on-error: true` lets the workflow run pass when that job fails. Source: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
- When a workflow is skipped because of a `paths`, `paths-ignore` or branch filter, or a skip instruction in the commit message (`[skip ci]` and similar), its checks stay "Pending", and a pull request that requires those checks is blocked from merging. Source: same page, section on `paths`.
- Whether a check is required for merging is set in branch protection or rulesets, not in the workflow file. Record it as `unknown — outside repo` unless the user supplies the setting.

### Docker Compose

- `depends_on` with `condition: service_started` (also the short form) only orders container start; it does not wait for the dependency to be ready. `condition: service_healthy` waits until the dependency's healthcheck reports healthy. `condition: service_completed_successfully` waits until the dependency exits with code 0; a non-zero exit fails a required dependency. Source: docker/compose `pkg/compose/service_containers.go` (`shouldWaitForDependency`, `waitDependency`), https://github.com/docker/compose
- `service_healthy` only gates on what the dependency's `healthcheck.test` actually tests.

### Kubernetes

- Init containers run in sequence, each must succeed before the next starts, and app containers start only after all init containers have completed. Source: https://kubernetes.io/docs/concepts/workloads/pods/init-containers/
- A failing readiness probe removes the Pod's IP from the EndpointSlices of matching Services, so the Pod stops receiving traffic from them. Readiness probes run for the whole life of the container. Source: https://kubernetes.io/docs/concepts/workloads/pods/probes/
- A failing liveness probe (past its failure threshold) makes the kubelet restart the container. Liveness probes do not wait for readiness. Source: same page.
- If a startup probe is set, liveness and readiness probes do not run until it succeeds; if it fails, the container is killed and its restart policy applies. Source: https://kubernetes.io/docs/concepts/workloads/pods/pod-lifecycle/
- A probe gates only on what its endpoint or command actually checks. Read the handler.
