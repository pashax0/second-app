# ai-first-project-boilerplate

A structured boilerplate for AI-assisted development with **Claude Code** and **Cursor**.

## Branches

| Branch | Contents |
|---|---|
| `base` | Universal, language-agnostic setup |
| `typescript` | base + TypeScript rules and config |
| `nestjs` | typescript + NestJS setup |
| `vitejs` | typescript + Vite/React setup |
| `python` | base + Python rules and config |

## Start a new project

Uses [degit](https://github.com/Rich-Harris/degit) — downloads branch content without git history, giving you a clean slate.

```bash
# Pick the branch that matches your stack
npx degit pashax0/ai-first-project-boilerplate#base my-project
npx degit pashax0/ai-first-project-boilerplate#nestjs my-project
npx degit pashax0/ai-first-project-boilerplate#vitejs my-project

cd my-project
git init
./setup.sh        # recreate .cursor/rules/ symlinks
```

Then fill in the TODO sections in `CLAUDE.md` and this `README.md`.

---

## What's inside

### `.llm/rules/` — single source of truth for AI rules

Universal rules loaded into every AI session. Edit here — changes apply to both Claude Code and Cursor automatically.

| File | Purpose |
|---|---|
| `behavior.md` | How AI should approach changes and decisions |
| `code-style.md` | Universal code style principles |
| `git-workflow.md` | Conventional commits, branching |
| `testing.md` | Testing philosophy |
| `workflow.md` | Plan → Implement → Verify → Fix loop |
| `examples/typescript.md` | Template for language-specific rules |

**How it works:**
- `CLAUDE.md` imports rules via `@.llm/rules/*.md`
- `.cursor/rules/` contains symlinks to `.llm/rules/` — Cursor reads them natively
- One file to edit, both tools stay in sync

### Skills — Claude Code slash commands

| Command | When to use |
|---|---|
| `/plan <task>` | Before implementing anything non-trivial |
| `/verify` | After each atomic implementation step |
| `/review` | Before committing — full code review |
| `/commit` | Create a conventional commit |
| `/debug <issue>` | Root cause analysis for bugs |
| `/backport` | Backport AI config improvements to the boilerplate |

### Agents — Claude Code subagents

| Agent | Purpose |
|---|---|
| `researcher` | Read-only codebase exploration (fast, Haiku model) |
| `reviewer` | Code review with persistent project memory |
| `debugger` | Systematic root cause analysis + minimal fix |

### `docs/`

| File | Purpose |
|---|---|
| `architecture.md` | High-level architecture overview |
| `decisions/ADR-template.md` | Template for Architecture Decision Records |

---

## Adding a new stack branch

```bash
git checkout base
git checkout -b nestjs

# Add stack-specific files:
# - .llm/rules/typescript.md (copy from examples/)
# - Add @.llm/rules/typescript.md to CLAUDE.md
# - Add the symlink to setup.sh
# - Add stack config files (e.g. tsconfig.json, package.json, pyproject.toml)

git add .
git commit -m "feat: nestjs template"
git push origin nestjs
```

## Backporting improvements to the boilerplate

When you improve AI config in a project (new rule, better skill, etc.) — backport it here.

### 1. Add boilerplate as a second remote (once per project)

```bash
git remote add boilerplate git@github.com:pashax0/ai-first-project-boilerplate.git
git fetch boilerplate
```

### 2. Backport a specific commit

```bash
# Find the commit hash with the improvement
git log --oneline --all -- .llm/ .claude/

# Create a backport branch from boilerplate/base
git fetch boilerplate
git checkout -b backport/my-improvement boilerplate/base

# Cherry-pick the commit
git cherry-pick <hash>

# Push to boilerplate
git push boilerplate backport/my-improvement:backport/my-improvement
```

Then open a PR from `backport/my-improvement` → `base` in the boilerplate repo.

### What to backport

Only AI config files — never project-specific code:

```
.llm/rules/          ← rule improvements
.claude/skills/      ← skill improvements
.claude/agents/      ← agent improvements
.claude/settings.json
setup.sh
CLAUDE.md            ← only structural changes, not project-specific content
```

### Using the skill

Run `/backport` in Claude Code for a guided workflow.

---

## Setup on a new machine

```bash
./setup.sh
```

Recreates `.cursor/rules/` symlinks if they were lost (e.g. on systems that don't preserve symlinks during copy).

---

## Project README template below

When using this boilerplate, replace everything above this line with your project's README.

---

# Project Name

<!-- TODO: Replace with your project description -->

## Getting started

```bash
# Install
# <install command>

# Dev
# <dev server command>
```

## Development

```bash
# Tests: <test command>
# Lint:  <lint command>
# Build: <build command>
```

## Architecture

See [docs/architecture.md](docs/architecture.md) and [docs/decisions/](docs/decisions/).
