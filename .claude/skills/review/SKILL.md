---
name: review
description: Review recent code changes for quality, correctness, and potential issues. Use after implementing a feature or before committing.
context: fork
agent: Explore
---

Review the recent code changes in this project.

## Step 1: Get the diff

Run: `git diff HEAD` (or `git diff main` if on a feature branch)

If no diff, run: `git diff HEAD~1`

## Step 2: Review each changed file

For each file in the diff, check:

**Correctness**
- Does the logic do what it intends?
- Are edge cases handled (null, empty, boundary values)?
- Any off-by-one errors or type coercions?

**Code quality**
- Is the code readable and self-explanatory?
- Any unnecessary complexity or duplication?
- Functions doing too many things?

**Security**
- Any user input used without validation/sanitisation?
- Secrets or credentials hardcoded?
- SQL injection, XSS, command injection vectors?

**Tests**
- Are the changes covered by tests?
- Are existing tests still valid?

## Step 3: Output

Group findings by severity:

```
### Critical (must fix)
- <file>:<line> — <issue>

### Warning (should fix)
- <file>:<line> — <issue>

### Suggestion (consider)
- <file>:<line> — <note>

### Looks good
- <what was done well>
```

If there is nothing to flag, say so explicitly.
