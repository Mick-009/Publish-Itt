# CLAUDE.md

Working notes for Claude. Read this first when starting work in this repo.

## What Publish Itt is

An editorial book-writing app. The product persona is **Thad** — an experienced editor who shows up across the app via copy, chat, and analysis features. Everything user-facing is filtered through Thad's voice. The app is _not_ a generic SaaS — it's tonally distinct, and that's load-bearing.

[CONFIRM: one-line description of the product's actual selling point — "AI-assisted editing for novelists"? "Book project management with an editorial AI"? Adjust as you see fit.]

## Stack

- **Frontend:** React (Create React App + Craco), Tailwind, shadcn/ui primitives, lucide-react icons, sonner for toasts
- **Backend:** Python, FastAPI, [CONFIRM: MongoDB? PostgreSQL?]
- **Path alias:** `@/` resolves to `frontend/src/`
- **Routing:** React Router (top-level routes in `App.js`)
- **Auth:** in progress — see `contexts/AuthContext.jsx`, `components/ProtectedRoute.jsx`, `pages/AuthPage.jsx`, `backend/routers/auth.py`

## The Thad voice — load-bearing

This is the single most important section. Get the voice wrong and the product feels generic.

**What Thad sounds like:**

- Warm, declarative, often slightly metaphor-tinged
- Editorial, not transactional
- First-person where natural ("Bring me something to read", "I'll find a moment worth painting")
- Confident — never apologetic, never "Oops" / "Whoops" / "Sorry, nothing here"
- One short sentence per beat, not two

**What Thad never sounds like:**

- Corporate ("To get started, please create a project")
- Cute-tech ("Ready to roll?", "Let's gooo")
- Apologetic or self-deprecating about empty states
- Verbose — if you wrote two sentences, cut one

**Empty-state voice formula:**

- **Eyebrow** (optional, uppercase): a context cue — "THE WORKSHOP IS QUIET", "COVER & ART", "THE PIPELINE IS CLEAR"
- **Title:** one warm declarative line — "A blank page is a beginning.", "The corkboard is empty.", "Every cover starts with the book underneath."
- **Body:** one sentence about what happens when they act, not what's missing
- **CTA:** action verb, short — "Start a new project", "Add first note", "Save a version"

**Reference examples** in `frontend/src/pages/ManuscriptWorkspace.jsx`, `WorkflowWorkspace.jsx`, `ArtStudio.jsx`, `ToneStyleWorkspace.jsx`. Copy the voice from there — don't invent new patterns.

[TODO: drop in 2-3 of your favorite Thad lines from elsewhere in the app, especially from chat / analysis features, so voice consistency extends beyond empty states.]

## Art & illustration conventions

SVG illustrations live in `frontend/src/components/EmptyStateArt.jsx`. Conventions:

- **Stroke-based line drawings** — no fills, except small accent dots/circles (ink, tacks, etc.)
- **`currentColor` only** — never hardcode hex/rgb. Lets art theme across all themes.
- **80px square** at base; component accepts `size` prop and scales.
- **Editorial line work** — feels hand-drawn, not clip art, not flat illustration, not Material icons.
- **No emoji**, no stock iconography for empty-state art.

When adding new art, mirror the existing files' geometry style.

## Component conventions

- Use `@/components/...` imports, never relative paths beyond one level
- shadcn/ui primitives are the base — don't introduce a new UI library
- Icons come from `lucide-react`. If a needed icon doesn't exist there, ask before adding another icon set.
- Toasts via `sonner`'s `toast()`. Don't introduce another toast library.
- `data-testid` naming: `kebab-case`, prefixed by surface — e.g. `empty-workflow-no-projects`, `empty-artstudio-new-project`. Pattern: `{surface}-{element}` or `empty-{surface}-{role}`.
- Theme tokens via Tailwind CSS variables — `text-muted-foreground`, `bg-card`, `border`, etc. Don't hardcode colors.

## Empty-state primitive

`frontend/src/components/EmptyState.jsx` is the shared primitive. Three sizes:

- `size="page"` — full-route gates (blocks workspace until they act). Larger type, max-width centered.
- `size="panel"` — inside a side panel or card. Tighter.
- `size="inline"` — for narrow lists where even `panel` is too tall.

Props: `art`, `eyebrow`, `title`, `body`, `primaryAction`, `secondaryAction`, `testId`. Action shape: `{ label, icon, onClick, showArrow?, testId }`.

**Use this primitive for any new empty-state surface.** Don't recreate the pattern inline.

Exception: `<SelectItem>` inside dropdowns can't host a full EmptyState — for those, voice-refresh the placeholder text only. See examples in `ArtStudio.jsx` (presets dropdown, chapter-select dropdown).

## Don'ts

- Don't introduce new UI libraries (MUI, Mantine, Chakra) — shadcn primitives only
- Don't introduce new state management (Redux, Zustand) without asking — current app uses React Context + local state
- Don't write copy that uses "Oops", "Whoops", "Sorry", or apologizes for empty states
- Don't hardcode colors — Tailwind theme tokens only
- Don't use emoji in UI copy or illustrations
- Don't use generic icon-only empty states (icon + "No X yet" + flat description). Use the `EmptyState` primitive.
- Don't summarize big files unprompted — read what's needed for the task

## When in doubt

- Match the voice and conventions of `ManuscriptWorkspace.jsx` and `ArtStudio.jsx` — those are the most polished surfaces
- Read the file being modified before editing — pattern-match local conventions over global ones
- Ask one specific question rather than guessing on architecture decisions
- Surfaces I haven't touched (auth flow, settings, dashboard) probably have their own established patterns — read first, don't impose empty-state conventions everywhere

## Running locally

Two terminals.

**Frontend** (from `frontend/`):

```bash
yarn build
npx serve -s build -l 3000
```

Serves the production build on `http://localhost:3000`. Note: this is a build-and-serve flow, not a dev server with hot reload — rebuild after changes.

**Backend** (from `backend/`):

```bash
source venv/Scripts/activate
uvicorn server:app --reload --port 8001
```

FastAPI on `http://localhost:8001`. The `--reload` flag auto-restarts on backend file changes.

[CONFIRM: any required `.env` setup, MongoDB/database start commands, or seed/migration steps that need to run first.]

## Repo layout (key paths)

```
frontend/
  src/
    components/        Shared components (EmptyState, panels, dialogs)
    pages/             Top-level routes (Manuscript, Workflow, ArtStudio, etc.)
    contexts/          React Context providers (AuthContext)
    hooks/             Custom hooks
    lib/               Utilities (api.js, utils)
backend/
  app/                 [CONFIRM: structure]
  routers/             FastAPI route modules (auth.py, etc.)
  server.py            App entry
  migrate.py           [CONFIRM: migration runner?]
```

## Out of scope (don't touch unless asked)

- `node_modules/`, `build/`, `__pycache__/`, `venv/` — generated/dependency
- `mock_images/` — test fixtures
- `.env` and any credentials — never commit, never modify
