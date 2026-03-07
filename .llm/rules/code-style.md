---
description: Universal code style principles. Apply to all source files.
alwaysApply: true
---

# Code Style

## Core principles

- Write code for humans first, machines second
- Prefer explicit over clever — obvious code beats clever code
- Do one thing per function, one responsibility per module
- Delete dead code; don't comment it out

## Naming

- Names should reveal intent — if you need a comment to explain a name, rename it
- Booleans: use `is`, `has`, `can`, `should` prefix (`isLoading`, `hasError`)
- Functions: verb or verb phrase (`getUserById`, `validateInput`)
- Avoid abbreviations unless universally known (`url`, `id`, `api` are fine; `usrNm` is not)

## Functions

- Keep functions short — if it doesn't fit on one screen, split it
- Single level of abstraction per function
- Prefer pure functions (same input → same output, no hidden side effects)
- Limit parameters — more than 3 is a sign to use an object/struct

## Comments

- Don't comment what the code does — write code that explains itself
- Do comment WHY when the reason is non-obvious (workaround, business rule, gotcha)
- Keep comments up to date or delete them

## Error handling

- Never silently swallow errors
- Fail fast and loudly in development
- Handle errors at the right level — not too early, not too late
- Always handle async failures explicitly

## Files and modules

- One primary concern per file
- Keep files under ~300 lines — if longer, consider splitting
- Imports/dependencies at the top
