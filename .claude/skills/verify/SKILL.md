---
name: verify
description: Verify that the last implemented step is complete and correct. Checks changed files for correctness, edge cases, and consistency with the plan. Use after each atomic implementation step.
context: fork
agent: Explore
---

Verify the most recent code changes.

## Step 1: Get the changes

Run `git diff HEAD` to see what was changed.
If the user specified files or a scope, focus on those.

## Step 2: Check completeness

- Does the implementation match the stated plan/goal?
- Is anything from the plan skipped or only partially done?
- Are there TODO/FIXME left that should have been resolved?

## Step 3: Check correctness

- Does the logic handle the happy path correctly?
- Edge cases: null/undefined, empty collections, boundary values, concurrent access
- Error paths: are failures handled, or silently swallowed?
- Any obvious bugs, off-by-one errors, or incorrect conditions?

## Step 4: Check consistency

- Does the code follow the patterns used elsewhere in the project?
- Naming consistent with the codebase?
- No unnecessary complexity introduced?

## Step 5: Run checks if available

If test/lint/typecheck commands are defined in CLAUDE.md, run the relevant one for the changed files.

## Output

```
### Status: PASS / NEEDS FIXES

### Completeness
- [ ] <what was done>
- [ ] <anything missing>

### Issues found
- `file:line` — description

### Ready to proceed
<yes / no — and what to fix if no>
```
