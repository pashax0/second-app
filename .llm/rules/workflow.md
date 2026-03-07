---
description: Development workflow loop. Plan depth scales with task complexity.
alwaysApply: true
---

# Workflow Loop

One loop for all tasks. Plan depth scales with complexity — a simple fix needs 2-3 lines; a multi-milestone feature needs full breakdown.

## 1. Plan

- Gather context: read existing code, related files — verify theory before making claims
- Describe the solution; for complex tasks — add non-goals, milestones, acceptance criteria
- **Self-validate**: are all edge cases covered? are all claims grounded in actual code?
- For complex tasks — document key decisions: what was chosen vs. rejected and why
- **Get approval: wait for user confirmation before implementing**
- Use `/plan` for medium/complex tasks to produce a structured plan

## 2. Implement

- For complex tasks: complete **one atomic step at a time** — one task from the plan, one logical unit
- After each atomic step: verify it works → report to user → **STOP**
- **Never chain multiple steps automatically** — next step starts only on explicit user instruction
- Keep changes focused and atomic

## 3. Verify (autonomous)

After implementing, verify **without asking the user** using this sequence:

```bash
# 1. TypeScript check
pnpm --filter mobile typecheck

# 2. Start dev server, capture logs
kill $(lsof -ti:8081) 2>/dev/null; true
cd apps/mobile && pnpm web -- --clear > /tmp/expo.log 2>&1 &
# Wait for bundling
sleep 30 && grep -E "Bundled|error|ERROR|Failed" /tmp/expo.log

# 3. Confirm server is up
curl -s http://localhost:8081/ | grep -c "DOCTYPE"

# 4. Wait for runtime errors (Expo forwards browser console to terminal)
sleep 10 && grep -E "^( ERROR| WARN)" /tmp/expo.log

# 5. Kill server when done
kill $(lsof -ti:8081) 2>/dev/null
```

**Pass criteria:**
- TypeScript: exit code 0
- Metro: "Bundled Xms" present, no "error"/"Failed" lines
- Server: curl returns HTML
- Runtime: no `ERROR` lines in log after load

**Only notify user when all checks pass.** If any check fails — fix and re-run autonomously.

- Confirm the plan step is fully realized — nothing skipped
- Quick self-check: architecture, naming conventions, edge cases
- If new findings affect the solution — address them before moving on

## 4. Fix

- Address failures immediately — don't defer to later steps
- Re-run the full verify sequence after each fix

_(Repeat 2–4 for each milestone)_

---

**After all work is complete:**

- Run `/review` on all changed files
- Fix any issues found
- Update docs if architecture/patterns/logic changed
- Suggest running `/commit` — wait for user to invoke it explicitly
- **NEVER autonomously run**: `git commit`, `git push`, `git rebase`, `git reset`, `git merge`, `git checkout`
- **NEVER open a PR** without explicit user instruction

## End of Session

Before ending any session, update `memory/MEMORY.md`:
1. Update `## ▶ Next Session Start` with current branch, what was done, and a ready-to-paste prompt
2. Update `## Roadmap` to reflect completed items
3. Update `## Known Gotchas` if new issues/solutions were found

The next session prompt should be self-contained: branch name + what's done + what to do next.

---

## Scaling Guide

| Task size | Plan | Milestones | Progress tracking |
|---|---|---|---|
| Simple (1 step) | 2–3 lines | — | — |
| Medium (2–3 steps) | Solution + non-goals | 2–3 explicit | — |
| Complex (3+ steps) | Full breakdown + decisions | Each with scope | Externalized log |

### Externalized Progress (complex tasks)

For long tasks, maintain a progress section in the plan that survives `/compact`:

- Completed milestones (one-liner each)
- Current milestone and remaining work
- Key decisions made
- Known issues to address later

Update after each milestone — this acts as durable memory the agent re-reads to stay oriented.
