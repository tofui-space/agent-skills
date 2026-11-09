#!/usr/bin/env bash
set -u
pilot="$(cd "$(dirname "$0")" && pwd)"
work="$(mktemp -d)"

printf '%-34s %-6s %-9s %-4s %-13s %-13s\n' fault stale admitted tsc tests-before tests-after

seed() {
  local id="$1" file="$2" edit="$3" extra="${4:-}"
  local dir="$work/$id"
  mkdir -p "$dir"
  rsync -a --exclude node_modules --exclude reports --exclude .stryker-tmp "$pilot/" "$dir/"
  ln -s "$pilot/node_modules" "$dir/node_modules"
  perl -0pi -e "$edit" "$dir/$file"
  if cmp -s "$pilot/$file" "$dir/$file"; then echo "$id: edit did not apply" && return; fi
  cd "$dir" || return
  local stale admitted tsc before after
  if node tools/inventory.ts --check $extra | grep -q STALE; then stale=yes; else stale=no; fi
  before=$(node --test 'test/*.test.ts' 2>&1 | awk '/^ℹ fail/ {print $3}')
  if node tools/inventory.ts $extra >/dev/null; then admitted=yes; else admitted=no; fi
  if node_modules/.bin/tsc -p . >/dev/null; then tsc=ok; else tsc=error; fi
  after=$(node --test 'test/*.test.ts' 2>&1 | awk '/^ℹ fail/ {print $3}')
  printf '%-34s %-6s %-9s %-4s %-13s %-13s\n' "$id" "$stale" "$admitted" "$tsc" "${before}-failed" "${after}-failed"
  cd "$pilot" || exit
}

seed F1-decision-new-hunk src/decisions/authorize.ts \
  "s/(  if \(input.role === 'reviewer' && input.operation === 'grantApproval'\))/  if (input.role === 'owner' && input.operation === 'grantApproval') return 'setApproved'\n\$1/"
seed F2-classifier-deleted-check src/classifiers/account-state.ts \
  "s/  if \(failedLogins < 0\) return 'suspended'\n//"
seed F2b-same-with-code-only-cells src/classifiers/account-state.ts \
  "s/  if \(failedLogins < 0\) return 'suspended'\n//" --partition=code
seed F3-classifier-new-hunk src/classifiers/account-state.ts \
  "s/(  if \(failedLogins >= 5\))/  if (failedLogins === 3) return 'suspended'\n\$1/"
seed F4-wiring-branch src/wiring/provider-request.ts \
  "s/const outcome = await execute\[plan\]\(deps, req\)/const outcome = plan === 'deny' ? 'denied' : await execute[plan](deps, req)/"
seed F5-wiring-swapped-arguments src/wiring/provider-request.ts \
  "s/tenant: req.tenant,\n    ownership: req.ownership,/tenant: req.ownership,\n    ownership: req.tenant,/"
seed F6-wiring-hidden-call src/wiring/provider-request.ts \
  "s/(  const plan = authorize)/  const startedAt = Date.now()\n\$1/"
seed F7-new-plan-variant src/types.ts "s/'editTag'\n/'editTag' | 'archive'\n/"
seed F8-new-role src/types.ts "s/'visitor'\n/'visitor' | 'auditor'\n/"
seed F9-adapter-drops-conflict src/adapters/provider-store.ts \
  "s/    if \(error instanceof VersionConflict\) return 'conflict'\n//"
seed F14-adapter-swallows-unnamed-errors src/adapters/provider-store.ts \
  "s/    throw error\n/    return 'unavailable'\n/"
seed F10-decision-two-booleans src/decisions/derive-role.ts \
  "s/  reviewerFlag: boolean,\n/  reviewerFlag: boolean,\n  suspendedFlag: boolean,\n/"
seed F11-tagged-union-new-variant src/decisions/approval-facts.ts \
  "s/(  \| Readonly<\{ kind: 'unavailable' \}>\n)/\$1  | Readonly<{ kind: 'locked' }>\n/"
seed F12-string-classifier-deleted-check src/classifiers/credential-kind.ts \
  "s/    token.includes\\('\\\\u2028'\\) \\|\\|\\n//"
seed F13-string-classifier-widened-count src/classifiers/credential-kind.ts \
  "s/length === 3/length >= 3/"
seed F15-regex-widened-count src/classifiers/library-card.ts \
  "s/\[0-9\]\{6\}/[0-9]{5,6}/"
seed F16-regex-dropped-anchor src/classifiers/library-card.ts \
  "s/\/\^\(M-/\/(M-/"
seed F17-regex-range-end src/classifiers/library-card.ts \
  "s/\[A-Z\]\{2\}/[A-Y]{2}/"
seed F18-two-numbers-off-by-one src/classifiers/loan-state.ts \
  "s/today <= dueOn \+ 7/today < dueOn + 7/"
seed F19-two-numbers-swapped src/wiring/renewal-request.ts \
  "s/classifyLoan\(lookup.loan.dueOn, req.today\)/classifyLoan(req.today, lookup.loan.dueOn)/"
seed F20-unknown-weakened-test src/classifiers/current-day.ts \
  "s/Number.isSafeInteger/Number.isInteger/"
seed F21-data-adapter-drops-variant src/adapters/loan-catalog.ts \
  "s/    if \(error instanceof NoOpenLoan\) return \{ kind: 'none' \}\n//"
seed F22-data-adapter-shared-variant src/adapters/loan-catalog.ts \
  "s/(    throw error\n)/    if (error instanceof RangeError) return { kind: 'unavailable' }\n\$1/"
seed F23-guard-removed src/wiring/renewal-request.ts \
  "s/  if \(!isCurrentDay\(req.today\)\) return refusal.malformedDay\n//"
seed F24-guards-reordered src/wiring/renewal-request.ts \
  "s/(  if \(!isLibraryCard\(req.card\)\) return refusal.unreadableCard\n)(  if \(!isCurrentDay\(req.today\)\) return refusal.malformedDay\n)/\$2\$1/"
seed F25-guard-replaced-by-cast src/wiring/renewal-request.ts \
  "s/  if \(!isCurrentDay\(req.today\)\) return refusal.malformedDay\n(.*)req.today\)\]/\$1req.today as never)]/s"
seed F26-new-lookup-variant src/adapters/loan-catalog.ts \
  "s/(  \| \{ readonly kind: 'unavailable' \}\n)/\$1  | { readonly kind: 'blocked' }\n/"
seed F27-wiring-catches-rejection src/wiring/renewal-request.ts \
  "s/await findLoan\(deps.catalog, req.card\)/await findLoan(deps.catalog, req.card).catch(() => ({ kind: 'unavailable' as const }))/"
seed F28-optional-number-off-by-one src/classifiers/hold-state.ts \
  "s/today <= holdUntil/today < holdUntil/"
seed F29-object-property-weakened-test src/classifiers/renewal-form.ts \
  "s/Number.isSafeInteger\(input.today\)/typeof input.today === 'number'/"
seed F30-object-property-check-dropped src/classifiers/renewal-form.ts \
  "s/typeof input.card === 'string' && //"
seed F31-regex-flag-added src/classifiers/library-card.ts \
  "s/\\\$\/\.test/\\\$\/i.test/"
seed F32-capture-instead-of-slice src/classifiers/shelf-kind.ts \
  "s/  const title = mark.slice\(4, -5\)\n/  const title = \/^[A-Z]{3} (.+) [0-9]{4}\\\$\/.exec(mark)?.[1] ?? ''\n/"
seed F33-lookahead-dropped src/classifiers/desk-passphrase.ts \
  "s/\(\?=\.\*\[a-z\]\)//"
seed F34-word-boundary-dropped src/classifiers/staff-note.ts \
  "s/staff\\\\b/staff/"
seed F35-nested-property-check-dropped src/classifiers/hold-request.ts \
  "s/ \|\| input.kind !== 'hold'//"
seed F36-slice-start-off-by-one src/classifiers/shelf-kind.ts \
  "s/mark.slice\(4, -5\)/mark.slice(3, -5)/"
seed F37-contract-lists-another-error spec/contracts/node@24.ts \
  "s/(        \},\n      \],\n      ensures)/        },\n        { error: RangeError, when: 'the text nests too deep', provoke: () => JSON.parse('[1,') },\n      ],\n      ensures/"
seed F38-contract-other-version spec/contracts/node@24.ts \
  "s/version: '24'/version: '23'/"
seed F39-contract-clause-not-kept spec/contracts/node@24.ts \
  "s/Number.POSITIVE_INFINITY/Number.MAX_VALUE/"
seed F40-conversion-rounding src/conversions/due-day.ts \
  "s/Math.floor\(dueAt/Math.trunc(dueAt/"
seed F41-conversion-divisor src/conversions/due-day.ts \
  "s/86_400_000/86_400/"
seed F42-conversion-fraction src/conversions/due-day.ts \
  "s/Math.floor\((dueAt.getTime\(\) \/ 86_400_000)\)/(\$1)/"
seed F43-result-claim-not-kept spec/contracts/node@24.ts \
  "s/path: 'values', is: 'object'/path: 'values', is: 'array'/"

mkdir -p "$work/F5b" && cat >"$work/F5b/swap.ts" <<'EOF'
type Input = { readonly sameTenant: boolean; readonly ownsProvider: boolean }
declare const req: Input
export const swapped: Input = { sameTenant: req.ownsProvider, ownsProvider: req.sameTenant }
EOF
if (cd "$work/F5b" && "$pilot/node_modules/.bin/tsc" --strict --noEmit swap.ts); then tsc=ok; else tsc=error; fi
printf '%-34s %-6s %-9s %-4s\n' F5b-boolean-swap-control - - "$tsc"
rm -rf "$work"
