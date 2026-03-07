---
description: Testing philosophy and conventions.
alwaysApply: true
---

# Testing

## Philosophy

- Test behaviour, not implementation details
- A test that breaks on refactoring without changing behaviour is a bad test
- Tests are documentation — they should explain what the code does

## What to test

- Happy path
- Edge cases and boundary conditions (empty, null, zero, max values)
- Error and failure paths
- **Don't test**: framework internals, trivial getters/setters, implementation details

## Test structure — Arrange, Act, Assert

```
// Arrange
const user = createUser({ role: 'admin' })

// Act
const result = canDeletePost(user, post)

// Assert
expect(result).toBe(true)
```

- One assertion per logical concept (not necessarily one `expect`)
- Each test must be independent — no shared mutable state between tests
- Tests must be deterministic — same result every run

## Naming

Describe what the system does under what condition:

```
"returns null when user is not found"
"throws AuthError when token is expired"
"sends welcome email after registration"
```

## Running tests

<!-- TODO: add your test commands -->
