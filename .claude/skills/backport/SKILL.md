---
name: backport
description: Backport AI config improvements from this project back to the boilerplate repository. Use when you've improved a rule, skill, or agent and want to update the boilerplate.
disable-model-invocation: true
---

Guide the user through backporting AI config improvements to the boilerplate.

## Step 1: Check if boilerplate remote exists

Run: `git remote -v`

If `boilerplate` remote is missing, show this command and stop:
```
git remote add boilerplate git@github.com:pashax0/ai-first-project-boilerplate.git
git fetch boilerplate
```
Ask the user to run it, then invoke `/backport` again.

## Step 2: Find relevant commits

Show commits that touched AI config files:
```
git log --oneline -- .llm/ .claude/ setup.sh CLAUDE.md
```

List them and ask: "Which commit(s) contain the improvement you want to backport?"

## Step 3: Identify the target branch

Ask: "Which boilerplate branch should this go into — `base`, or a stack branch like `typescript`?"

## Step 4: Prepare the backport branch

```bash
git fetch boilerplate
git checkout -b backport/<short-description> boilerplate/<target-branch>
```

## Step 5: Cherry-pick

```bash
git cherry-pick <hash>
```

If there are conflicts, list them clearly and ask the user to resolve before continuing.

## Step 6: Review what will be pushed

Show `git diff boilerplate/<target-branch>` so the user can confirm only AI config changes are included — no project-specific code.

If project-specific content is found, flag it and ask the user whether to amend the commit before pushing.

## Step 7: Remind to push manually

Show the push command but do NOT run it:
```
git push boilerplate backport/<short-description>:backport/<short-description>
```

Remind the user to open a PR from `backport/<short-description>` → `<target-branch>` in the boilerplate repo.
