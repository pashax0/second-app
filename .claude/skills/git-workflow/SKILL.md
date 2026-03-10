---
name: git-workflow
description: Git workflow rules for this project — branches, merging, and commit conventions. Load when the user mentions git, branches, merging, committing, or version control operations.
---

# Git Workflow

## Branches

- `master` — production-ready only, always deployable
- `p0NN_<name>` — feature branches, numbered sequentially (p011_archive, p012_images, …)

## Feature completion — ALWAYS in this order

1. `git commit` on feature branch
2. Ask user: merge to master?
3. After approval: `git checkout master && git merge --no-ff <branch> -m "..."`
4. Update `▶ Next Session Start` in memory: write the suggested next branch name and a ready-to-go prompt
5. Stay on master — **do NOT create the next branch now**

## Session start — ALWAYS first thing

If memory says a branch needs to be created (i.e. we're on `master` and `▶ Next Session Start` names a `p0NN_*` branch):

```bash
git checkout -b p0NN_name
```

Create it before doing any other work. Never work directly on `master`.

## Commits — Conventional Commits

Format: `<type>(<scope>): <description>`

Types: `feat` | `fix` | `chore` | `docs` | `refactor` | `test` | `perf`

Examples:
```
feat(auth): add refresh token rotation
fix(api): handle null response from payment provider
chore: upgrade dependencies to latest
```

Rules:
- Subject line under 72 characters — no exceptions
- Present tense, lowercase, no period at end
- Body (optional) explains WHY, not what — the diff shows what
- Never list changed files in the body

## Pull Requests

- One concern per PR
- Small PRs get reviewed faster — prefer multiple small over one large
- Don't force-push to shared branches
