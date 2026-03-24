---
description: Git workflow and commit message conventions.
alwaysApply: true
---

# Git Workflow

## Branches

- `main` — production-ready only, always deployable
- `p0NN_<name>` — feature branches, numbered sequentially (p011_archive, p012_images, …)

## Feature completion — ALWAYS in this order

1. `git commit` on feature branch
2. Ask user: merge to master?
3. After approval: `git checkout master && git merge --no-ff <branch> -m "..."`
4. Immediately after merge: `git checkout -b p0NN_next` — create next feature branch
5. Only after the new branch exists: update `▶ Next Session Start` in memory with the new branch name

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
