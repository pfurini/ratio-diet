---
name: Align Ultracite scripts
overview: Diagnose why `pnpm check` and `pnpm fix` show different results with Ultracite in Oxlint/Oxfmt mode, then make scripts deterministic so formatting and lint results are both visible and predictable.
todos:
  - id: confirm-root-cause
    content: Confirm command sequencing behavior and current failing files from pnpm check output
    status: completed
  - id: refactor-scripts
    content: Update package scripts to separate format and lint checks/fixes and compose deterministic check/fix
    status: completed
  - id: sync-docs
    content: Update README quick-reference to reflect new scripts and expected behavior
    status: completed
  - id: verify-flow
    content: Run check/fix/check sequence to confirm output consistency
    status: completed
isProject: false
---

# Align `check` and `fix` behavior

## What I verified

- In your current setup, `pnpm check` runs `ultracite check` and `pnpm fix` runs `ultracite fix` from [package.json](/Users/paolof/Developer/Projects/ratio-diet/package.json).
- Your backend is Oxlint/Oxfmt mode (no ESLint/Biome config files; `.oxlintrc.json` exists): [.oxlintrc.json](/Users/paolof/Developer/Projects/ratio-diet/.oxlintrc.json).
- `ultracite` v7.2.5 runs formatter first, then linter for both commands; in `check` mode, formatter uses `--check` and exits early on formatting failures, so lint does not run after formatting fails.
- Running `pnpm check` currently reports only formatting failures in:
  - `apps/web/src/app/page.tsx`
  - `apps/web/src/app/todos/page.tsx`

## Root cause

- The perceived mismatch is due to command sequencing, not different engines:
  - `check`: `oxfmt --check` -> if non-zero, process exits before `oxlint`
  - `fix`: `oxfmt --write` -> then `oxlint --fix`, which can still report remaining lint issues

## Proposed solution

- Make scripts explicit so formatting and linting are independently visible:
  - `format`: `oxfmt --write .`
  - `format:check`: `oxfmt --check .`
  - `lint`: `oxlint .`
  - `lint:fix`: `oxlint --fix .`
  - `check`: run both checks and return failure if either fails
  - `fix`: run formatter first, then lint autofix
- Keep `ultracite` installed for presets/config management, but use direct tool scripts for predictable CI/local output.
- Keep `check:ultracite` and `fix:ultracite` aliases in `package.json` for parity/debugging.

## Files to update

- [package.json](/Users/paolof/Developer/Projects/ratio-diet/package.json)
- [README.md](/Users/paolof/Developer/Projects/ratio-diet/README.md) (quick-reference commands, if documented)

## Validation after changes

- Run `pnpm check` and confirm both formatter + lint outputs appear consistently.
- Run `pnpm fix`, then `pnpm check` to confirm clean state (or only non-fixable lint errors remain).

