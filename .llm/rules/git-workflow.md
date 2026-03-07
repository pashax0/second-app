---
description: Git workflow and commit message conventions.
alwaysApply: true
---

# Git Workflow

## Branches

- `main` — production-ready only, always deployable
- `feat/<name>` — new features
- `fix/<name>` — bug fixes
- `chore/<name>` — tooling, deps, refactor, docs

## Commits — Conventional Commits

Format: `<type>(<scope>): <description>`

Types: `feat` | `fix` | `chore` | `docs` | `refactor` | `test` | `perf`

```
feat(auth): add refresh token rotation
fix(api): handle null response from payment provider
chore: upgrade dependencies to latest
refactor(db): extract query builder into separate module
```

Rules:
- Present tense, lowercase, no period at end
- Subject line under 72 characters
- Body (optional) explains WHY, not what — the diff shows what

## Pull Requests

- One concern per PR
- Small PRs get reviewed faster — prefer multiple small over one large
- Don't force-push to shared branches
- Rebase on main before merging, don't create merge commits
