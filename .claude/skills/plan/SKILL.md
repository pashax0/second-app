---
name: plan
description: Plan a feature, refactor, or non-trivial change before any code is written. Explores the codebase, asks clarifying questions, then produces a structured written plan saved to docs/plans/. Use when the task touches multiple files, when the approach is unclear, or when the user says "plan", "план", "спланируй", "продумай", "design", "approach", or asks how to implement something.
when_to_use: Trigger when the user invokes /plan, says "let's plan X", "план для X", "спланируй X", "продумай как сделать X", "how should we approach X", "design a feature", "разработай план", or is about to start a multi-step implementation that touches >1 file.
argument-hint: [task description]
---

You are about to plan a change. Follow these steps strictly — do NOT write any code yet.

## Core principle: a plan describes *what*, not *how*

A plan is a contract about **behaviour, scope, and acceptance** — not a solution. The user must be able to read the plan, agree with the goal, and **still be free to choose any implementation** during the actual work.

**A plan must NOT contain:**
- Code, SQL, or pseudocode of any kind
- Names of specific functions, RPCs, triggers, tables, columns, libraries, or framework APIs as part of the solution (referencing them as *existing context* in Gap-анализ is fine — see below)
- Operations like «INSERT в X», «UPDATE Y», «через RPC Z», «прямой запрос», «через триггер» — these are the «how»
- Library / dependency choices («используем `@dnd-kit`», «через React Hook Form»)
- Field-level data shape decisions
- Phrases like «реализуем через», «подход — …», «механизм …», «использовать паттерн X из файла Y»

**A plan MUST contain:**
- User-visible behaviour: «пользователь может сделать X и увидеть Y»
- Scope boundaries: что входит / не входит
- Acceptance criteria: как мы поймём, что шаг сделан (наблюдаемое поведение, не код)
- Open behavioural questions for the user to decide

When you catch yourself writing «через», «UPDATE», «RPC», «триггер», «using library», «прямой …» — stop. That belongs in implementation, not the plan.

## Step 0: Decide if a plan is even needed

Plan depth scales with complexity (see [.llm/rules/workflow.md](../../../.llm/rules/workflow.md) → Scaling Guide):

| Task size | What to do |
|---|---|
| Simple (1 step, 1 file) | Skip the skill. Reply with 2–3 lines and ask for approval inline. |
| Medium (2–3 steps) | Short plan: solution + non-goals + 2–3 milestones. May still skip the docs/plans/ file if scope is tight. |
| Complex (3+ steps, multi-file, schema/API) | Full breakdown. Save to `docs/plans/<slug>.md`. |

If the task is clearly Simple, do NOT generate a heavy plan — answer briefly and stop.

## Step 1: Understand the request

The task is: $ARGUMENTS

If the request is vague, ask clarifying questions before exploring. Cover only what's blocking — don't interrogate:
- Expected behaviour and acceptance criteria
- Edge cases / non-goals
- Constraints (perf, backwards compat, deadline, data migration)
- Existing related work to extend vs. replace

## Step 2: Explore the codebase

Use Read, Glob, Grep (or delegate broad exploration to the `Explore` agent) to ground the plan in reality. Verify before claiming.

- Which files / modules are relevant?
- What patterns are already in use? (Match them — see `.llm/rules/behavior.md` and personal rule «match existing conventions».)
- What can break? Cross-cutting concerns: RLS, RPC, types in `packages/shared`, mobile + admin parity.
- Are there related ADRs in `docs/decisions/`? Existing context in `.llm/context/`?
- Is there an existing plan in `docs/plans/` to extend or supersede?

## Step 3: Write the plan

Use this structure:

```markdown
# План: <title>

Статус: draft (waiting for approval) | approved (in progress) | done

## Gap-анализ

<What user-visible behaviour exists today vs. what's missing. Link files **only as evidence** that the gap is real ("today this page does X — see file:line"). Do not describe the implementation of the gap.>

## Поведенческие решения

<Decisions about behaviour, scope, UX — never about implementation. Examples of valid decisions: «редактирование разрешено только для scheduled-дропа», «удалённый дроп пропадает безвозвратно», «при публикации показываем превью». Examples of INVALID decisions (these belong in implementation): «через RPC X», «прямой UPDATE», «используем библиотеку Y», «триггер сделает Z».>

## План (что должен уметь пользователь после каждого шага)

| # | Что станет возможным | Acceptance |
|---|---|---|
| 1 | <одна наблюдаемая способность пользователя — глагол + объект> | <что пользователь видит / делает, чтобы убедиться> |
| 2 | … | … |

The «Что станет возможным» column describes **user behaviour**, not engineering tasks. Bad: «добавить поле discount_percent в форму». Good: «задать скидку на дроп при создании».
The «Acceptance» column describes **observable outcomes**, not how to test internals. Bad: «UPDATE на drops срабатывает». Good: «создать дроп со скидкой 15% — на детали показано −15%».

После каждого шага: stop, report, ждём подтверждения перед следующим.

## Non-goals

- <What we explicitly are NOT doing in this plan, and why>

## Риски

- <Known unknowns, things that may break, fallbacks>

## Прогресс

- [ ] Шаг 1: <one-liner>
- [ ] Шаг 2: …
```

Notes on the format:
- **Атомарные шаги**: one milestone = one user-visible capability. Don't bundle multiple capabilities into a single row.
- **Acceptance column** is mandatory — what the user does or sees to confirm the capability works.
- **Прогресс** is the durable progress log — it survives `/compact` and is what you re-read to stay oriented (see workflow.md → Externalized Progress).
- Headings in Russian by convention (see template above). English is fine if a plan is heavily English-only.

### Self-check before showing the plan

Re-read what you wrote and remove any line that contains:
- SQL keywords (INSERT, UPDATE, DELETE, SELECT, CREATE, ALTER)
- Names of internal functions/RPCs/triggers/tables/columns as part of the solution (mentioning them in Gap-анализ as evidence of current state is fine; using them in the «План» column is not)
- Library or dependency names presented as the chosen tool
- Words like «через», «прямой», «механизм», «реализуем», «using …»

If a step reads like an engineering ticket («добавить поле X в форму», «вызвать RPC Y») — rewrite it as user behaviour («задать скидку при создании дропа», «удалить товар из дропа»). The implementation is decided **at the moment of doing the step**, not now.

## Step 4: Ask for approval

End with: «Does this plan look good? I'll wait for your approval before writing any code / saving the plan.»

Do NOT save the file or start implementation until the user approves.

## Step 5: Save the approved plan

Once approved (and only for Medium/Complex tasks):

1. Pick a kebab-case slug matching the feature: `docs/plans/<slug>.md` (e.g. `push-notifications.md`, `orders-admin.md`).
2. Write the plan there. Update `Статус: approved`.
3. Reference it in the conversation: «План сохранён в [docs/plans/&lt;slug&gt;.md](../../../docs/plans/<slug>.md), приступаю к шагу 1.»

## Step 6: Maintain the plan during implementation

After every atomic step (per workflow.md → Implement → Verify → Fix loop):

- Tick the corresponding `[ ]` → `[x]` in the «Прогресс» section with a one-line summary of what shipped (mention key files / migrations / RPCs).
- If new findings change the approach — update the relevant section (Архитектурные решения / steps / non-goals) **before** moving on. Don't silently drift from the plan.
- If a step is split or merged — renumber and note why.

The plan is the durable memory of the task **while implementation is in progress**.

## Step 7: Retire the plan when done

Once all steps ship, the plan file should not stay in the repo as a historical artifact — `git log` already preserves the trail. Instead:

1. **Extract non-derivable bits** into permanent docs:
   - Development rules / conventions → `.llm/rules/*.md`
   - Domain / lifecycle facts → `.llm/context/*.md`
   - Service-level decisions, scope, roadmap → `apps/<name>/architecture.md` or `docs/architecture.md`
   - Long-lived architectural choices → `docs/decisions/ADR-*.md`
2. **Drop the rest** — gap-анализ, completed checklist, mid-implementation risks are historical noise.
3. **`git rm docs/plans/<slug>.md`** and clean up any references that linked to it.

If a plan section has nothing worth promoting — that's fine, just delete the file. The goal is one source of truth per fact, not a museum of completed plans.
