# Public npm CI cache

A composite action for **public npm tarballs** on Linux runners
(glibc or musl; amd64 and arm64 use separate keys). Installs still use `npm ci`, the checked-in lockfile and npm's
SHA-512 integrity checks. It never restores `node_modules`, native build
outputs, `.npmrc`, logs, credentials, or another package manager's store.

```yaml
permissions:
  contents: read
steps:
  - uses: actions/checkout@v6
    with:
      persist-credentials: false
  - uses: fricker-studios/github-actions/npm-ci@<reviewed-commit-SHA>
    with:
      node-version-file: frontend/.nvmrc
      working-directory: frontend
      install-command: make node-env-ci
```

`working-directory` identifies the lockfile. `install-command` runs from the
checkout root, so use `npm --prefix frontend ci --no-audit --no-fund` if the
repository has no Make target. This command is repository code: never form it
from PR titles, comments, labels, or other untrusted strings. Do not perform
additional downloads or change the registry inside it. Private/Git/local
packages fail closed in the lockfile check; use a separately designed,
credential-isolated cache policy for those projects.

## Why this differs from setup-node caching

The exact key includes the lockfile hash. A fallback prefix reuses tarballs
from another lockfile **in the same project and repository**, partitioned by
OS, architecture, libc family, Node major, npm major and explicit epoch.
`prefer-offline` uses cached immutable tarballs; missing packages still fetch
normally and any install error stays an error. `npm ci` rejects lock drift.
Node/npm minor changes do not require another archive of identical tarballs.

Only `_cacache` is archived. The job's private writable cache is under
`RUNNER_TEMP`, which is on ARC's ephemeral SSD work volume. It is not a
persistent cache by itself. Each job restores its own copy; there is no shared
writable PVC or `node_modules` and no cross-job cleanup race.

A successful install saves immediately, before lint/tests. Failed installs
never save. Two jobs missing the same key can both install; cache reservation
selects the writer, and a losing reservation is harmless. This avoids unsafe
shared writes but does not deduplicate the first simultaneous cold downloads.
Exact hits are immutable; bump `cache-epoch` if an archive needs replacing.
There is deliberately no fallback to the old setup-node namespace: the new
policy starts with a measured cold seed and its own compatibility partition.

## Trust and failure behavior

- Use `pull_request`, never `pull_request_target` (explicitly rejected). Fork
  PRs must run on isolated GitHub-hosted runners with no secrets or internal
  network access. The action does not make a privileged ARC runner safe.
- GitHub's cache service, or the self-hosted v9.7.0 backend with token validation
  enabled, enforces signed repository/ref scopes. A PR cannot publish a cache
  to main; main seeds the fallback accessible to later PRs. Same-repository PR
  saves are scoped to their PR. Fork saves are disabled by this action.
- Cache only public dependencies: fork PRs may read default-branch caches.
  No registry credentials are required or passed for this pilot. Cache keys
  are not an authorization mechanism. Never disable backend token validation.
- Restore/save errors warn but do not determine build success. Installation
  still fails when required data is unavailable. Archive download segments
  time out after two minutes; the toolkit's other network timeouts still apply.
- Registry down + complete cache: install succeeds without registry requests.
  Registry down + a missing tarball: install fails. Cache backend down + fresh
  job: npm fetches upstream; if both are down the install fails. There is no
  retry using weaker integrity, unlocked resolution, or ignored exit codes.
- This does not cache Node distributions, Actions downloads, lifecycle-script
  network fetches, Playwright browsers or container build dependencies.

## Operations

Job summaries report exact/prefix/miss outcome, matched key, install seconds,
cache size and save result. npm HTTP logging in the install step exposes
requests/misses. A high archive hit rate does not prove low npm WAN traffic.

The lab backend has 14-day idle retention (daily cleanup, so allow one extra
day), a 100 GiB finalized-payload budget, and eviction to 90% after upload.
Concurrent uploads can temporarily exceed the budget. Monitor hit/miss and
storage metrics plus Postgres/MinIO health. No new service or PVC is required.
On GitHub-hosted runners the repository's GitHub cache retention/quota applies.
Ephemeral job directories disappear with the runner; no shared cleanup script
is needed. Review key counts and sizes weekly during rollout, monthly after.

Roll out first to Allegro's PR and main UI lint jobs. Seed on main after review,
then measure a changed lockfile PR before expanding. Other jobs/repos retain
their existing policy. Roll back the caller to setup-node's previous cache
configuration; the new keys can expire naturally. Bump `cache-epoch: v2` for
invalidation. Review action/backend version updates and test cold/warm/failure
behavior before pin updates.

Tests: `node --test npm-ci/prepare.test.mjs`. The workflow exercises concurrent
fixture installs, save races and offline reinstalls; the Allegro pilot supplies
representative package-count and network measurements.
