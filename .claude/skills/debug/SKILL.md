---
name: debug
description: Systematically debug an error or unexpected behaviour. Finds root cause and implements a minimal fix. Use when something is broken and the cause is not obvious.
disable-model-invocation: true
---

Debug the following issue: $ARGUMENTS

## Step 1: Capture the error

If an error message or stack trace is available, read it fully.

Ask the user if needed:
- What is the exact error message?
- What steps reproduce it?
- What was the expected behaviour?
- When did it start happening? (after a specific change?)

## Step 2: Locate the failure

- Find the file and line where the error originates
- Read the relevant code, including callers
- Check recent git changes in that area: `git log --oneline -10 -- <file>`

## Step 3: Form a hypothesis

State your hypothesis: "I believe the issue is X because Y."

Do NOT start fixing before you have a clear hypothesis.

## Step 4: Verify the hypothesis

- Add targeted logging or read variable states
- Write a minimal failing test case if appropriate
- Confirm the hypothesis is correct before writing a fix

## Step 5: Fix

- Implement the minimal fix that addresses the root cause
- Do NOT refactor surrounding code unless directly related
- Do NOT suppress the error — fix the underlying cause

## Step 6: Verify the fix

- Run the relevant tests: confirm they pass
- Confirm the original error no longer occurs
- Check for regressions

Report:
```
Root cause: <explanation>
Fix applied: <what changed and where>
Verified by: <how you confirmed it works>
```
