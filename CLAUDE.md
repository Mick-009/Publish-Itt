# CLAUDE.md

Working notes for Claude. Read this first when starting work in this repo.

## What Publish Itt is

An editorial book-writing app for novelists and storytellers. The product
persona is **Thad** — an experienced editor who shows up across the app via
copy, chat, and analysis features. Everything user-facing is filtered
through Thad's voice. The app is _not_ a generic SaaS — it's tonally
distinct, and that's load-bearing.

**Positioning statement (locked, repeat verbatim):**

> Writing a book is a craft, not a content problem. Publish Itt is a writing
> platform for novelists and storytellers who want an editor-in-chief, not
> an autocomplete. Thad reads your work, pushes back, and keeps your book
> on track from first chapter to final draft.

The "editor-in-chief, not autocomplete" framing drives downstream decisions
— Thad notices and suggests, the writer decides. He doesn't overrule the
author on facts about their own work (e.g. the workflow stage nudge fires
forward only, never backward).

## Stack

- **Frontend:** React (Create React App + Craco), Tailwind, shadcn/ui
  primitives, lucide-react icons, sonner for toasts
- **Backend:** Python 3.13, FastAPI, MongoDB
- **Path alias:** `@/` resolves to `frontend/src/`
- **Routing:** React Router (top-level routes in `App.js`)
- **Auth:** JWT-based, established. See `contexts/AuthContext.jsx` (exposes
  `user`, `loading`, `updateUser` for optimistic merge),
  `components/ProtectedRoute.jsx`, `pages/AuthPage.jsx`,
  `backend/routers/auth.py`. Login/register return `TokenResponse` with an
  embedded `UserOut`. The `/me/preferences` endpoint accepts partial
  updates; mirror that pattern for any new user-level settings.

## The Thad voice — load-bearing

This is the single most important section. Get the voice wrong and the
product feels generic.

**What Thad sounds like:**

- Warm, declarative, often slightly metaphor-tinged
- Editorial, not transactional
- First-person where natural ("Bring me something to read", "I'll find a
  moment worth painting")
- Confident — never apologetic, never "Oops" / "Whoops" / "Sorry, nothing
  here"
- One short sentence per beat, not two
- Sentence case for headers and copy (not Title Case Throughout)
- No emoji in UI copy
- No exclamation marks outside dialogue (very rare exceptions only)

**What Thad never sounds like:**

- Corporate ("To get started, please create a project")
- Cute-tech ("Ready to roll?", "Let's gooo")
- Apologetic or self-deprecating about empty states
- Verbose — if you wrote two sentences, cut one
- "Failed to X" — say "Couldn't X. Try again?" instead

**Verb families (use these consistently):**

- **Pin / Pinned** for notes (not "save" / "saved", not "comment")
- **Read it** for AI analysis (not "Analyze")
- **Push back** for Thad disagreement (not "challenge", not "argue")
- **Send to a reader** for chapter sharing (NOT "Share" — never "Share")
- **Bring in** for imports (not "upload")
- **Gone for good — can't undo.** for destructive confirmations

**Banned phrases (never use):**

- "creative companion"
- "let me know"
- "lightly mythic"
- "your journey"
- "I'm here to help"
- "Welcome!"
- "Get started"

**Empty-state voice formula:**

- **Eyebrow** (optional, uppercase): a context cue — "THE WORKSHOP IS
  QUIET", "COVER & ART", "THE PIPELINE IS CLEAR"
- **Title:** one warm declarative line — "A blank page is a beginning.",
  "The corkboard is empty.", "Every cover starts with the book underneath."
- **Body:** one sentence about what happens when they act, not what's
  missing
- **CTA:** action verb, short — "Start a new project", "Add first note",
  "Save a version"

**Reference examples** in `frontend/src/pages/ManuscriptWorkspace.jsx`,
`WorkflowWorkspace.jsx`, `ArtStudio.jsx`, `ToneStyleWorkspace.jsx`. Copy
the voice from there — don't invent new patterns. The hand-authored eight-
step tour in `lib/tourSteps.js` is also a strong reference for voice.

## Workflow stages — locked taxonomy

Nine stages, in order. The stored `status` on a project is canonical — both
the Stage tab arc and the `/workflow` page pipeline read from this. Don't
re-define stages anywhere else; everything imports from `lib/utils.js`.

1. **concept** — An idea, taking shape.
2. **outline** — Chapters mapped, plot sketched.
3. **draft** — Words on the page, end to end.
4. **revisions** — The big moves — structure, arc.
5. **editing** — Line by line, sentence by sentence.
6. **layout** — Format, design, the way it sits.
7. **art** — Cover, illustrations, what readers see first.
8. **proofing** — The last read, hunting for what slipped past.
9. **published** — Out in the world.

The AI workflow analysis returns a coarser six-stage vocabulary (Idea
Drop / Outline / Draft / Revise / Polish / Complete) which is translated to
the canonical nine via `remapAiStageToStatus()` in `lib/utils.js`. The AI is
a _nudge_ — when it reads further along than the stored status, it
surfaces "this reads like Draft, want to move it?" The nudge fires forward
only; never tell a writer they've regressed.

## Art & illustration conventions

SVG illustrations live in `frontend/src/components/EmptyStateArt.jsx`.
Conventions:

- **Stroke-based line drawings** — no fills, except small accent dots/
  circles (ink, tacks, etc.)
- **`currentColor` only** — never hardcode hex/rgb. Lets art theme across
  all themes.
- **80px square** at base; component accepts `size` prop and scales.
- **Editorial line work** — feels hand-drawn, not clip art, not flat
  illustration, not Material icons.
- **No emoji**, no stock iconography for empty-state art.

When adding new art, mirror the existing files' geometry style.

## Component conventions

- Use `@/components/...` imports, never relative paths beyond one level
- shadcn/ui primitives are the base — don't introduce a new UI library
- Icons come from `lucide-react`. If a needed icon doesn't exist there,
  ask before adding another icon set.
- Toasts via `sonner`'s `toast()`. Don't introduce another toast library.
- `data-testid` naming: `kebab-case`, prefixed by surface — e.g.
  `empty-workflow-no-projects`, `empty-artstudio-new-project`. Pattern:
  `{surface}-{element}` or `empty-{surface}-{role}`.
- Theme tokens via Tailwind CSS variables — `text-muted-foreground`,
  `bg-card`, `border`, etc. Don't hardcode colors.

## Empty-state primitive

`frontend/src/components/EmptyState.jsx` is the shared primitive. Three
sizes:

- `size="page"` — full-route gates (blocks workspace until they act).
  Larger type, max-width centered.
- `size="panel"` — inside a side panel or card. Tighter.
- `size="inline"` — for narrow lists where even `panel` is too tall.

Props: `art`, `eyebrow`, `title`, `body`, `primaryAction`, `secondaryAction`,
`testId`. Action shape: `{ label, icon, onClick, showArrow?, testId }`.

**Use this primitive for any new empty-state surface.** Don't recreate the
pattern inline.

Exception: `<SelectItem>` inside dropdowns can't host a full EmptyState —
for those, voice-refresh the placeholder text only. See examples in
`ArtStudio.jsx` (presets dropdown, chapter-select dropdown).

## Backend patterns

### The `UserOut` splat pattern (load-bearing — don't violate)

When returning a `UserOut` from a mongo document, **always splat the doc
through Pydantic with `**user_doc`\*\* rather than enumerating fields by
hand:

```python
# RIGHT
user_doc.pop("_id", None)
user_doc.pop("hashed_password", None)
user_doc.setdefault("daily_word_goal", 500)
return UserOut(**user_doc)

# WRONG — silently drops any field on UserOut not enumerated here
return UserOut(
    id=user_doc["id"],
    email=user_doc["email"],
    # ... new fields silently default ...
)
```

The hand-built pattern was the cause of a real bug — `tour_complete` and
`onboarding_complete` were being silently defaulted to `false` at login
because the login endpoints didn't include them in their hand-built
`UserOut(...)` calls. The splat pattern means future fields on `UserOut`
"just work" with no further code changes. `get_current_user` is the
reference implementation; align all endpoints to it.

- **Account delete cascade** covers all twelve collections above
  (verified via `backend/test_delete_cascade.py`). When adding a new
  user-owned or project-owned collection, add it to the cascade in
  `DELETE /auth/me` and to `test_delete_cascade.py`.

### Optimistic UI updates

The pattern across the app is: update local React state immediately, then
persist via API. On failure, revert. Examples in `handleStageChange`
(ManuscriptWorkspace.jsx) and `handleSaveGoal` (Settings.jsx). Mirror this
shape — it keeps the UI responsive and the failure path explicit.

## Don'ts

- Don't introduce new UI libraries (MUI, Mantine, Chakra) — shadcn
  primitives only
- Don't introduce new state management (Redux, Zustand) without asking —
  current app uses React Context + local state
- Don't write copy that uses "Oops", "Whoops", "Sorry", or apologizes for
  empty states
- Don't hardcode colors — Tailwind theme tokens only
- Don't use emoji in UI copy or illustrations
- Don't use generic icon-only empty states (icon + "No X yet" + flat
  description). Use the `EmptyState` primitive.
- Don't summarize big files unprompted — read what's needed for the task
- Don't auto-commit. The user commits manually. Phase deliverables and let
  them review.
- Don't sprawl one task into adjacent work without flagging first. If you
  notice a side issue, name it and ask before fixing it.
- Don't change brand strings, product copy, or the positioning statement
  without surfacing the change first.
- Don't enumerate `UserOut` fields by hand — splat via `**user_doc`.

## When in doubt

- Match the voice and conventions of `ManuscriptWorkspace.jsx`,
  `ArtStudio.jsx`, and `lib/tourSteps.js` — those are the most polished
  surfaces
- Read the file being modified before editing — pattern-match local
  conventions over global ones
- Ask one specific question rather than guessing on architecture decisions
- For destructive operations (deletes, bulk updates), surface the plan
  before executing. Show the user the cascade or the affected scope.

## Running locally

Two terminals.

**Frontend** (from `frontend/`):

```bash
# Iterative dev (with hot reload):
yarn start

# Production-shape testing (build + serve):
yarn build && npx serve -s build -l 3000
```

`yarn start` for iterative work. The build-and-serve flow is for testing
the deployed shape.

**Backend** (from `backend/`):

```bash
source venv/Scripts/activate   # Git Bash
# or:
.\venv\Scripts\Activate.ps1    # PowerShell

uvicorn server:app --reload --port 8001
```

Dev setup (lint, type-check, tests): `pip install -r requirements-dev.txt`
Production / Render: installs `requirements.txt` only — dev tools are not included.

FastAPI on `http://localhost:8001`. `--reload` auto-restarts on backend
file changes.

**Standing rule:** after any backend edit, wait for the terminal to print
`Application startup complete` before testing. A stale server silently
serves the old response model — new fields (e.g. `canvas_items`) won't
appear until Uvicorn has fully reloaded. This has burned us more than once.

**MongoDB:** assumed running locally on default port. No special start
command — connection details in backend `.env`.

## Repo layout (key paths)

```
frontend/
  src/
    components/        Shared components (EmptyState, panels, dialogs)
                       Key: WorkflowPanel.jsx, NotesPanel.jsx, ThadTour.jsx,
                       ImportAnalysisDialog.jsx, EmptyStateArt.jsx
    pages/             Top-level routes
                       Key: ManuscriptWorkspace.jsx, WorkflowWorkspace.jsx,
                       Dashboard.jsx, Settings.jsx, AuthPage.jsx,
                       OnboardingFlow.jsx, SharePage.jsx, ArtStudio.jsx
    contexts/          React Context providers (AuthContext, ThemeContext)
    hooks/             Custom hooks (useWritingSession, useStats,
                       useChapterAutosave, useSelectionNotes)
    lib/               Utilities (api.js, utils.js, tourSteps.js,
                       constants.js, onboardingStash.js)
backend/
  routers/
    auth.py            JWT auth, /register, /login, /me, /me/preferences
  server.py            App entry. Contains: projects, chapters, versions,
                       notes, writing-sessions, style-presets, art profile,
                       export, AI endpoints, import analysis & split
  shares.py            Send-to-a-reader subsystem (public namespace at
                       /api/public/shares/*)
  thad_revisions.py    Push-back history (db.thad_revisions) and Thad's
                       standing notes (db.thad_style_notes)
  onboarding.py        Onboarding samples + completion gate
  exports.py           EPUB/PDF/DOCX export
  prompts.py           All LLM system prompts and prompt builders
  migrate.py           One-time user_id backfill (safe to re-run)
  rescue.py            Orphan-stamping rescue utility
```

## MongoDB collections (canonical list)

User-scoped (every document carries `user_id`):

- `projects`, `chapters` (chapters owned via `project_id` but most
  endpoints filter by user), `notes`, `versions`, `writing_sessions`,
  `style_presets`, `shares`, `users`

Project-scoped only (no direct `user_id` — owned via `project_id`):

- `thad_revisions`, `thad_style_notes`, `art_assets`, `book_art_profiles`,
  `worldbuilding_items`, `worldbuilding_connections`

Parked / problematic (see "Known parked issues" below):

- `manuscripts_collection` (the import endpoint writes here without
  user_id; not safe to remove)

## Known parked issues

These are real problems we've consciously deferred rather than not noticed.
Don't try to fix them unbidden — surface them if you encounter them and
let the user decide.

- **`manuscripts_collection`** is a deprecated collection that
  `action_import_manuscript` (in server.py) still writes to without a
  `user_id`. This means imported manuscripts land in a collection nothing
  reads from cleanly, and they won't be caught by user-scoped operations
  (including account-delete cascade). Fixing requires deciding whether
  imports should create a project, append to an existing chapter, etc. —
  a feature decision, not cleanup.
- **`thad_tour` backend stack** — the frontend tour is hand-authored
  (`lib/tourSteps.js`); the backend tour endpoint was removed in a sweep,
  but if anything tour-related re-appears in the backend, it's stale.
- **Import → "Split into chapters" feature** had a wiring bug where the
  single-action path didn't actually call the splitter. Fixed (see
  ImportAnalysisDialog.jsx and ManuscriptWorkspace.jsx
  handleImportActionComplete). If split appears broken again, check that
  branch first.

## Out of scope (don't touch unless asked)

- `node_modules/`, `build/`, `__pycache__/`, `venv/` — generated/dependency
- `mock_images/` — test fixtures
- `.env` and any credentials — never commit, never modify

---
