---
name: commit
description: Create a well-structured git commit from staged or recent changes. Follows Conventional Commits format.
disable-model-invocation: true
---

Create a git commit for the current changes.

## Step 1: Check what's staged

Run `git status` and `git diff --staged`.

If nothing is staged, run `git diff HEAD` to see unstaged changes and ask the user which files to include.

## Step 2: Understand the changes

Read the diff carefully. Identify:
- The type of change: feat / fix / chore / refactor / test / docs / perf
- The scope (optional): which module/area is affected
- The core reason for the change (the "why")

## Step 3: Stage and commit

If files need staging, stage them selectively (not `git add .` unless appropriate).

Write the commit message following Conventional Commits:
```
<type>(<scope>): <short description>

[optional body — explain WHY if not obvious]
```

Rules:
- Subject line max 72 characters
- Present tense, lowercase, no period
- Body explains motivation, not the diff itself

## Step 4: Verify

Run `git log --oneline -3` to confirm the commit was created correctly.

Report the commit hash and message to the user.
