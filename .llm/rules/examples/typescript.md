---
description: TypeScript-specific rules and conventions.
alwaysApply: false
globs: ["**/*.ts", "**/*.tsx"]
paths:
  - "**/*.ts"
  - "**/*.tsx"
---

# TypeScript

## Types

- Prefer explicit types on function signatures — avoid implicit `any`
- Use `interface` for object shapes that may be extended; `type` for unions, intersections, aliases
- No `as` casting unless unavoidable — fix the type instead
- Enable `strict` mode — no exceptions
- Prefer `unknown` over `any` when type is truly unknown

## Patterns

- Use ES modules (`import`/`export`), not CommonJS
- Prefer `const` over `let`, never `var`
- Destructure imports when importing multiple named exports
- Async/await over raw Promises
- Use optional chaining (`?.`) and nullish coalescing (`??`) — not `||` for defaults

## Naming

- Types and interfaces: `PascalCase`
- Enums: `PascalCase` for name, `UPPER_SNAKE_CASE` for values
- Generic type params: single uppercase letter (`T`, `K`, `V`) or descriptive (`TItem`, `TKey`)

## React (if applicable)

- Functional components only — no class components
- Props interface named `<ComponentName>Props`
- Extract complex logic into custom hooks (`use<Name>`)
- Co-locate component, styles, and tests in same directory
