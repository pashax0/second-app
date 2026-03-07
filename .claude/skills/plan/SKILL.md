---
name: plan
description: Start a plan-first workflow for a new feature or change. Explores the codebase, asks clarifying questions, then produces a written plan before any code is written. Use when the task touches multiple files or the approach is unclear.
disable-model-invocation: true
---

You are about to plan a change. Follow these steps strictly — do NOT write any code yet.

## Step 1: Understand the request

The task is: $ARGUMENTS

If the request is vague, use AskUserQuestion to clarify before proceeding:
- What is the expected behaviour?
- Are there edge cases to handle?
- Are there constraints (performance, backwards compat, etc.)?

## Step 2: Explore the codebase

Use Read, Glob, and Grep to understand:
- Which files are relevant?
- What patterns are already in use?
- What could break?

## Step 3: Write the plan

Output a structured plan with:

```
## Plan: <title>

### What
<1-2 sentence summary of the change>

### Why
<The reason / problem being solved>

### Files to change
- `path/to/file` — what changes and why

### Files to create
- `path/to/new-file` — what it will contain

### Approach
<Step-by-step implementation approach>

### Risks / open questions
<Anything uncertain or that needs decision>
```

## Step 4: Ask for approval

End with: "Does this plan look good? I'll wait for your approval before writing any code."

Do NOT start implementation until the user explicitly approves.
