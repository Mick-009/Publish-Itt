# WORLDBUILDING_SPEC.md

Living spec for the world-building canvas feature. Revise whenever reality
argues with what's written here — the spec serves the work, not the other
way around.

This document is the source of truth for what we're building in v1, how
v1.1 and v1.2 extend it, and the principles that govern decisions the spec
doesn't anticipate. Read this before working on canvas-related code.

---

## Why this feature exists

Publish Itt's positioning is "an editor-in-chief, not an autocomplete."
That promise has a quiet implication: the editor-in-chief needs somewhere
to keep notes on the book *outside* the prose. Characters, places,
structural analyses, summaries — everything that's *about* the book but
isn't *in* the book.

Today, AI analytical output (character extraction, Lantern Path mapping,
chapter summaries, QA reads) has no real home. It runs, produces output,
and that output either gets buried in the History tab or floats free with
nowhere to live. The world-building canvas is the home.

It's also the single biggest gap between Publish Itt and the tools writers
shop. The competitor research that motivated this work named world-building
six or seven times as the thing every tool was missing — a visual,
free-form, project-spanning space where the world a writer is building
actually lives. Filling that gap is the highest-leverage thing on the
post-launch roadmap.

The canvas serves both purposes — home for AI analytical output, and
home for the writer's own world-building work. Those aren't separate
features. They're the same feature.

---

## Design principles

These are the rules we use when the spec doesn't anticipate the question.
When you're deciding something and you're not sure which way to go, come
back here.

**Start simple, then get complex as we build.** v1 ships with the smallest
set of card types and capabilities that delivers real value. v1.1 and
beyond add capability incrementally. Resist the urge to land more in v1.

**Ease in, don't overwhelm.** Writers who feel overwhelmed bounce. Writers
who get a clean v1 and grow into v1.1 stay. Every UI decision should
favor the writer who's seeing this for the first time, not the power user
who wants every affordance visible.

**The chapters hold prose. The canvas holds everything that's about the
prose.** AI analytical output goes to the canvas. The chapter remains the
home of the words themselves. This split is load-bearing — don't put
analytical output anywhere else.

**The data model is the foundation; the visual environment can evolve.**
v1, v1.1, and v1.2 all share the same data model. What changes between
them is the surrounding visual experience, not the canvas's underlying
structure.

**Cards are simple structures; freedom lives in the freeform body.** Each
card type has 2-4 well-known fields plus a freeform body. Resist the urge
to enumerate every aspect of a character or place — let the writer use
the body for what they need to capture.

**The library is a rendering layer, not the source of truth.** All canvas
state lives in MongoDB (positions, connections, card data). React Flow
renders it; it doesn't own it. This means we can swap the rendering
library later without migrating data.

---

## What's in v1

The minimum buildable canvas that delivers real value.

### Card types

Three card types in v1:

- **Character** — people in the story
- **Place** — settings, locations, anywhere the story happens
- **Note** — anything that doesn't fit Character or Place; themes, plot
  ideas, fragments, reminders

That's the full list for v1. Image and Link cards are scoped for v1.1.

### Card fields

Every card has a common envelope plus type-specific fields. The envelope
is uniform across types (this is the data model decision below). The
type-specific fields are small and intentional.

**Character card:**
- Title (the character's name)
- Role (one short string — protagonist, antagonist, mentor, foil, etc.)
- First seen (chapter reference, or freeform text if no chapter link)
- Body (freeform, the writer writes whatever they want here)

**Place card:**
- Title (the name of the place)
- Kind (one short string — city, room, planet, region, dream, etc.)
- First seen (chapter reference, or freeform text)
- Body (freeform)

**Note card:**
- Title (optional — note cards don't have to have titles)
- Body (freeform, the actual note)

The pattern: Character and Place are deliberately symmetric (Role vs Kind
is the only meaningful difference). Note is the catch-all with the lowest
friction. The writer's hands learn one card shape and reuse it.

### Connections between cards

Connections are **optional-typed, directed**:

- Every connection has a source card and a target card. Direction matters
  — flipping source and target creates a different connection.
- Every connection *can* have a label (a freeform string — "lives in,"
  "foreshadows," "killed," etc.), but doesn't have to. Writers who care
  about types fill them in. Writers who don't get plain directional arrows.
- A card **cannot** connect to itself. Self-connections don't carry
  meaning in this context.

The label is a freeform string, not an enum. We don't constrain what
writers can call a relationship. If we ever want to give Thad structured
world knowledge later, we can mine common labels and suggest them, but
we don't restrict upfront.

### Provenance

Three values for the `provenance` field on every card:

- `manual` — the writer created this card
- `ai` — Thad extracted this card; the writer has never edited it
- `ai_edited` — Thad extracted this card, but the writer has modified it

The `manual` → `ai` distinction is set at card creation. The `ai` → `ai_edited`
transition happens automatically the first time a writer edits an AI-created
card. The writer never picks the value; it's a derived signal.

**AI extraction always creates new cards. It never merges, never deletes.**
If the writer runs "Extract characters" on the same chapter twice, they get
two sets of character cards. This is intentional — smart merge is a real
feature with a real UX (conflict resolution, writer-facing merge UI) that
we deliberately defer. The writer is responsible for cleanup in v1. We
surface a "this will add cards, existing cards won't be touched" warning
before running extraction on a chapter that's been extracted before.

### Where things live (UI surfaces)

Two trigger surfaces for AI extraction in v1:

**Surface 1: The existing Read/Analysis panel inside the chapter.** The
writer is in the manuscript, opens the Read/Analysis panel, picks an
analytical action ("Extract characters," "Summarize chapter," "Lantern
Path," etc.), Thad processes, the result appears in the panel. The writer
clicks "Send to canvas" to keep it.

**Surface 2: A canvas-side toolbar.** When the writer is on the canvas,
they can trigger extraction without going back to a chapter. A small
toolbar at the bottom-center of the canvas exposes canvas actions.

Surface 3 (chapter list / context menu in the sidebar) is scoped for v1.1.

### The canvas toolbar (Surface 2)

Bottom-center floating toolbar, three functional groups:

**Add (left group):** A "+ Add" button that opens a small menu — Character,
Place, Note. Clicking one drops a new empty card on the canvas at the
center of the current viewport. The writer drags it where they want.

**Ask Thad (middle group):** A "Thad" button that opens a small menu of
analytical actions — "Extract characters from a chapter," "Summarize a
chapter," "Outline the book," etc. Each opens a chapter picker if needed,
then runs the action. Cards appear on the canvas when ready.

**View controls (right group):** Zoom in, zoom out, fit-to-view (show
everything), reset to 100%. Plus a small zoom percentage display.

That's it. Three groups, roughly 8 buttons total. The toolbar is **always
visible** but **lowers opacity when the writer is actively dragging or
editing a card**. It gets out of the way during real work, comes back when
not.

### CTAs in the Read/Analysis panel

The panel currently has CTAs for *generative* output (rewrites,
suggestions): Insert into chapter / Replace selection / Copy / Dismiss.

v1 adds *analytical* posture for AI output that's *about* the work, not
*in* the work. Analytical output gets different CTAs:

- **Send to canvas** (creates cards from the analysis)
- **Copy**
- **Dismiss**

The panel itself signals which posture the current result is in — a small
indicator or different header treatment makes it clear whether the writer
is looking at a rewrite (decide whether to take it) or an analysis
(decide whether to keep it).

### How analytical output becomes cards (type-aware splitting)

Per analytical action, the result is either one card or many. The shape
of the output matches what the writer needs to *do* with it. A character
list produces many cards (one per character) because the writer will
position and connect them individually. A chapter summary produces one
card because it's conceptually one thing.

First-pass mapping (refine when wiring each action):

- **Extract characters** → many cards (one per character)
- **Extract glossary terms** → many cards (one per term — likely Note
  cards in v1; may become a "Term" type later)
- **Apply Lantern Path structure** → many cards (one per stage: Spark,
  Exploration, Lantern Moment, Application, Resolution)
- **Chapter summary** → one card
- **Outline the book** → many cards (one per outlined section)
- **QA read** → one card

These mappings live with each analytical action's wiring, not as a global
config. When we wire each one, we make the call there.

### Empty state and populated state

Two scenarios, both natural:

**Empty state:** Writer opens the canvas for the first time, never
extracted anything, never added anything. They see a pan-able empty
surface with the toolbar at the bottom. That's it. Optional: one quiet
line of text faded over center — *"This is where your world lives. Add a
card, or ask Thad to extract from a chapter."* The text fades the moment
any card appears.

**Populated state:** Writer has been working in the manuscript, has
already extracted characters and run analytical actions from chapters.
They navigate to the canvas. The cards are already there, positioned by
the extraction's auto-layout (a soft grid, slightly offset to suggest
"these are starting positions, drag them where they belong").

Transition between states is silent — extracting cards from a chapter
populates the canvas without ceremony.

### Card colors v1

Each card type has its own color so writers recognize types at a glance.
Card colors **harmonize with the active theme** in v1 (deferred from
"theme-immune" because v1 lives inside the themed platform — see Surface
progression below). Three card colors selected for sufficient chroma to
read distinctly against any of the five theme backgrounds.

Color choices to be made during build, not in the spec. Constraint: each
color reads cleanly in default, evergreen, lantern, misty, and campfire
themes.

### Surface progression (v1 → v1.1 → v1.2)

The canvas's *visual environment* evolves across versions while the data
model and interaction stay constant.

- **v1 (this spec):** Canvas lives as a normal page inside Publish Itt's
  themed UI. The sidebar is visible, the platform's design language
  applies, the canvas is one route among many.
- **v1.1:** Canvas becomes a full-screen takeover modal. It ignores the
  theme, has its own visual palette and background, lives in its own
  visual world. The writer opens it deliberately and is fully inside the
  world-building space. Image and Link card types ship in v1.1 alongside
  Tags. Surface 3 (chapter list trigger) ships in v1.1.
- **v1.2:** Canvas opens in a separate browser window. Writers with two
  monitors can have the canvas on one and the prose on the other. Same
  data, same interactions, true spatial separation.

All three versions share the same data model and canvas library (React
Flow). The library is a rendering layer; what changes is the chrome
around it.

### Technology choice

**React Flow** (the xyflow library) for v1.

Reasoning, briefly:
- The data model is structured graph-like content (cards as nodes,
  connections as edges). React Flow speaks this language natively.
- React Flow is the boring, well-trodden choice for a feature that's
  already pushing the platform's complexity ceiling. The library
  shouldn't be where the difficulty lives.
- All canvas state lives in MongoDB. React Flow renders it. We're not
  married to the library — if v2 needs more, we can migrate.

A future "Sketchbook" page (post-v1.2, when the worldbuilding canvas is
stable) will likely use **tldraw** for freeform sketching, maps, mood
boards. The two surfaces serve different thinking (organized vs
exploratory) and deserve different tools. Worldbuilding stays React
Flow; Sketchbook would be its own scoping conversation when we get
there.

---

## Data model

### worldbuilding_items

One collection. All card types stored uniformly with a `type` field and
a flexible `data` subfield for type-specific content.

```python
{
  id: str,                        # uuid
  project_id: str,                # the project this card belongs to
  user_id: str,                   # the writer who owns it (cascade target)
  type: str,                      # "character" | "place" | "note"
  title: str,                     # the card's name/title (may be empty for note)
  position: { x: float, y: float },  # canvas coordinates
  provenance: str,                # "manual" | "ai" | "ai_edited"
  source_chapter_id: Optional[str],  # if extracted from a chapter
  extraction_id: Optional[str],   # groups cards from one AI run
  data: dict,                     # type-specific fields (see below)
  created_at: str,                # ISO 8601
  updated_at: str,                # ISO 8601
}
```

**Type-specific data shapes** (stored in the `data` subfield, validated
at the endpoint level per type):

Character `data`:
```python
{
  role: str,                # one short string, may be empty
  first_seen: str,          # chapter reference or freeform text, may be empty
  body: str,                # freeform, may be empty
}
```

Place `data`:
```python
{
  kind: str,                # one short string, may be empty
  first_seen: str,          # chapter reference or freeform text, may be empty
  body: str,                # freeform, may be empty
}
```

Note `data`:
```python
{
  body: str,                # the note itself, may be empty
}
```

**Why one collection instead of three:** Adding a new card type later
means adding an enum value and a renderer. Querying "all items in this
project" is one query. The downside is looser validation, which we accept
in exchange for flexibility. (See "Data model choice" in the reasoning
section at the bottom.)

### worldbuilding_connections

Connections live in their own collection. Each connection points from one
card to another, with optional label.

```python
{
  id: str,                  # uuid
  project_id: str,          # for cascade scoping
  user_id: str,             # for cascade scoping
  source_id: str,           # the "from" card's id
  target_id: str,           # the "to" card's id
  label: Optional[str],     # freeform, may be null or empty
  created_at: str,
  updated_at: str,
}
```

**Why separate collection (not embedded in items):** Bidirectional queries
("everything connected to this card") are clean. Editing a connection is
one update, not two. The cost is an extra query to load a project's
connections alongside its items — negligible at any realistic scale.

**Validation rule:** `source_id != target_id`. Self-connections rejected
at the endpoint.

### Cascade

Both new collections are project-scoped. Add to the existing account
deletion cascade in `DELETE /auth/me`:

```python
# In the project-scoped cascade block (alongside chapters, thad_revisions, etc.):
await db.worldbuilding_items.delete_many({"project_id": {"$in": project_ids}})
await db.worldbuilding_connections.delete_many({"project_id": {"$in": project_ids}})
```

Update `backend/test_delete_cascade.py` to include both collections in the
verification.

Update CLAUDE.md's "MongoDB collections" section to list both as
project-scoped.

### Indexes

```python
await db.worldbuilding_items.create_index([("project_id", 1)])
await db.worldbuilding_items.create_index([("project_id", 1), ("type", 1)])
await db.worldbuilding_connections.create_index([("project_id", 1)])
await db.worldbuilding_connections.create_index(
    [("project_id", 1), ("source_id", 1)]
)
```

The two-field indexes cover the common queries: "show me all character
cards in this project" and "show me all connections from this card."

---

## API contracts

All endpoints under `/api/worldbuilding/*`, authenticated via the standard
`get_current_user` dependency.

### Items

```
POST   /api/worldbuilding/items
  body: {
    project_id: str,
    type: "character" | "place" | "note",
    title?: str,
    position?: { x: float, y: float },  # defaults to viewport center
    data?: dict,                         # type-specific, validated
    source_chapter_id?: str,
    extraction_id?: str,
    provenance?: "manual" | "ai",        # defaults to "manual"
  }
  returns: full item doc

GET    /api/worldbuilding/items?project_id=...
  returns: list of items for the project

PATCH  /api/worldbuilding/items/{id}
  body: { title?, position?, data?, ... }  # any subset
  side effect: if provenance was "ai" and any non-position field is
               modified, flips to "ai_edited"
  returns: updated item doc

DELETE /api/worldbuilding/items/{id}
  side effect: also deletes any connections where source_id or target_id
               equals this id
  returns: { deleted: True, also_deleted_connections: int }
```

### Connections

```
POST   /api/worldbuilding/connections
  body: {
    project_id: str,
    source_id: str,
    target_id: str,
    label?: str,
  }
  validates: source_id != target_id (422 if equal)
  validates: both ids exist and belong to project_id
  returns: full connection doc

GET    /api/worldbuilding/connections?project_id=...
  returns: list of connections for the project

PATCH  /api/worldbuilding/connections/{id}
  body: { label?: str }  # only label is editable post-creation
  returns: updated connection doc

DELETE /api/worldbuilding/connections/{id}
  returns: { deleted: True }
```

### AI extraction endpoints (existing — modified for canvas)

The existing AI analysis endpoints (character extraction, summarization,
etc.) return analytical content. v1 adds a "send to canvas" path that
takes that content and creates the appropriate worldbuilding_items.

Two real shapes:

**Option 1: Two-step (analysis returns content, separate endpoint creates
cards from it).** Existing behavior. The frontend shows the result, the
writer clicks "Send to canvas," the frontend posts to POST
/api/worldbuilding/items repeatedly (or to a batch endpoint).

**Option 2: Single-step with flag (analysis can directly create cards if
requested).** The AI endpoint accepts a `send_to_canvas: bool`. If true,
it creates the cards server-side and returns the created card IDs. The
frontend doesn't have to do a follow-up post.

**Pick Option 2 for v1.** Reduces the round-trip, keeps the "send to
canvas" experience snappy. The analysis can still be reviewed in the
panel before sending — the `send_to_canvas` flag is set when the writer
clicks the button, not at initial analysis time. So the flow is:
1. Writer triggers analysis (`send_to_canvas: false` implicitly). Result
   appears in the panel.
2. Writer clicks "Send to canvas." Frontend sends a small "create cards
   from this result" request — either re-running with the flag, or a
   dedicated endpoint that takes the cached analysis result and
   materializes cards.

The exact wiring is a build-time call. Spec just locks: "creating cards
from analysis should be one round-trip from the writer's click, not
many."

**Batch card creation endpoint** (if needed for the above):

```
POST   /api/worldbuilding/items/batch
  body: {
    project_id: str,
    items: [
      { type, title, data, source_chapter_id, extraction_id, provenance, ... },
      ...
    ],
  }
  returns: { created: [item_doc, ...] }
```

This is used by the "send to canvas" flow when an analysis produced
multiple cards. Atomic from the writer's perspective — either all cards
are created or none are.

---

## Frontend architecture

### Routing

New route: `/worldbuilding/:projectId?`

Mirrors the pattern of existing project-scoped routes (`/manuscript/:projectId?`,
`/workflow/:projectId?`, etc.). Lives inside Layout, under ProtectedRoute.

Add to the sidebar nav in `Layout.jsx`. Suggested label: **"Worldbuilding"**
(matching the platform's verb family — declarative, single word). Suggested
icon: `Map` (already imported in Layout for the tour link — may want a
different one to avoid conflict).

Voice note: the page header on the worldbuilding route should reinforce
what this place *is* without being pedantic. Suggested header copy:
*"Where your world lives."* Subhead: *"Everything about the book that
isn't in it."*

### File plan

```
frontend/src/
  pages/
    WorldbuildingWorkspace.jsx       New. The canvas page.
  components/
    worldbuilding/
      WorldbuildingCanvas.jsx        New. React Flow integration.
      CardNode.jsx                   New. The base node renderer.
      CharacterCard.jsx              New. Type-specific node body.
      PlaceCard.jsx                  New.
      NoteCard.jsx                   New.
      CanvasToolbar.jsx              New. The bottom-center toolbar.
      ChapterPickerModal.jsx         New. For Surface 2 extraction triggers.
      ConnectionEdge.jsx             New. The line/label between cards.
  lib/
    api.js                           Modify. Add worldbuildingApi object.
  components/
    Layout.jsx                       Modify. Add nav item.
    ReadAnalysisPanel.jsx            Modify. Add "Send to canvas" CTA.
                                     (Or whatever the panel file is called.)
```

### Library

```bash
npm install @xyflow/react
```

(Confirmed during the tech spike: `@xyflow/react` v12+ is the current
canonical package. The old `reactflow` package is the legacy path. The
spike installed @xyflow/react@12.11.1 cleanly — no peer dependency
conflicts. Bundle impact: ~57 KB gzip JS, ~2.5 KB gzip CSS. Note:
@xyflow/react bundles its own zustand; if the app ever adds zustand as a
direct dependency, check version compatibility.)

### Data flow

The worldbuilding workspace loads on route entry:

```
WorldbuildingWorkspace mounts
  → calls worldbuildingApi.getItems(projectId)
  → calls worldbuildingApi.getConnections(projectId)
  → passes both to WorldbuildingCanvas
  → React Flow renders nodes (from items) and edges (from connections)
```

User interactions update both React Flow state and the backend
optimistically:

```
User drags a card to a new position
  → React Flow's onNodesChange fires with position delta
  → component state updates immediately (optimistic)
  → debounced PATCH /api/worldbuilding/items/{id} { position: { x, y } }
  → on failure, revert and toast error
```

Same pattern for connection creation, editing, deletion. Optimistic UI,
debounced persistence, revert on failure. Matches the optimistic pattern
already established in the codebase (e.g. ManuscriptWorkspace's stage
change).

### React Flow integration notes (updated with tech spike findings)

**Container sizing — load-bearing, learned in the spike.** React Flow
requires a container with an explicit, fixed size — it measures its
container's offsetWidth/offsetHeight to set the viewport. The app's
`<main className="flex-1 overflow-auto">` is a hazard: if the canvas can
grow, the page gets a scrollbar and scroll fights canvas pan.

The fix (proven in the spike): wrap the canvas in
`<div className="h-full overflow-hidden">`. This pins the canvas to
`<main>`'s height and suppresses the scroll escape hatch.

**Fragility to know about:** the `h-full` chain requires every ancestor
from `<html>` down to have explicit height (not just min-height). The
chain in this app: html → body → #root → `<div className="h-screen">`
(App.js) → `<main className="flex-1 overflow-auto">` (Layout.jsx) →
canvas wrapper `h-full`. If the App root's `h-screen` ever changes, the
canvas collapses to zero height. If the canvas ever renders as
zero-height, check this chain first.

**Input handling — decided, not default.** React Flow's default has
plain trackpad scroll zooming the canvas. Writers (unlike designers)
find this disorienting. Use:

```jsx
<ReactFlow zoomOnScroll={false} panOnScroll={true} ... />
```

Scroll pans; Ctrl+scroll (or pinch) zooms. This matches document-like
surface expectations and the "ease in, don't overwhelm" principle.


- Custom node types registered with React Flow. CardNode wraps the
  type-specific renderers.
- Custom edge type for ConnectionEdge (so we can render the optional
  label and our own arrow style).
- Pan/zoom handled by React Flow's built-in viewport.
- Selection state lives in React Flow; deletion key removes selected
  items/connections.

Specific React Flow features we'll use in v1:
- `<ReactFlow />` with controlled nodes and edges
- `onNodesChange`, `onEdgesChange` for position/state updates
- `onConnect` for drag-to-connect interactions
- `<Controls />` (built-in pan/zoom controls — may be replaced with our
  toolbar's view group)
- `<Background />` (subtle grid or dot pattern)

What we'll *avoid* in v1: minimap (defer to v1.1), keyboard shortcuts
beyond Delete (defer), multi-select sophistication (defer).

---

## Out of scope for v1

These are conscious deferrals. Don't add them unbidden. Surface them as
candidates for v1.1 if you encounter strong demand.

**Card types deferred:**
- Image cards (require image upload infrastructure that doesn't exist in
  the stack yet)
- Link cards (require URL preview / OG metadata fetching for a good UX)

**Features deferred:**
- Tags (cross-cutting feature; tag autocomplete, tag filtering, tag-based
  search all become required once we add tags)
- Note cards inheriting color from connected card type (deferred until
  the base color system is stable)
- Right-click context menu (deferred until base toolbar interaction is
  proven)
- Multi-select drag (single-select drag only in v1)
- Keyboard shortcuts beyond Delete (no copy/paste/duplicate hotkeys)
- Minimap
- Search across cards
- Filter by card type / provenance
- Export the canvas (as image, as PDF, as JSON)
- Undo/redo
- Smart merge for re-extraction (always-create-new in v1)

**Surfaces deferred:**
- Surface 3 (chapter list / sidebar trigger for extraction)
- The Sketchbook page (separate feature entirely, post v1.2)

---

## Known constraints and parked issues

These are realities to know about, not bugs to fix as part of this work.

**No image storage in the stack.** Publish Itt has no infrastructure for
storing user-uploaded binaries today. v1 doesn't need it. Image cards
(v1.1) will require this infrastructure to be built — likely filesystem
storage with a static-file route, or eventual S3-equivalent. Decision
deferred until v1.1 scoping.

**No real AI yet.** Per the broader platform status, AI calls are
heuristic / mock in localhost. The canvas's "send to canvas" path will
work with whatever the AI endpoint returns, mock or real. When real AI
is wired (post-MVP), no canvas changes are required — the data shape is
the same.

**Connection deletion behavior on item delete.** Deleting an item cascades
to its connections (the DELETE endpoint handles this). The frontend
should refresh its connection list after an item delete, or React Flow
will hold stale edges. Worth implementing carefully during build.

---

## Reasoning preserved (the why)

Decisions captured in detail, for "I forgot why we did this" moments.

### Data model choice (why one collection, not three)

Three real options were considered:

- **A:** One collection with a `type` field and flexible `data` subfield
  (chosen).
- **B:** Separate collection per type (characters, places, notes).
- **C:** Hybrid — common envelope with embedded type-specific subdocuments.

A wins for v1 because:
- Adding new card types later means adding an enum value, not a new
  collection.
- "All items in this project" is one query.
- Mongo's schema flexibility supports `data` as a loose dict cleanly.

The cost of A is looser validation (the `data` shape isn't enforced at
the database level). Accepted in exchange for flexibility. Per-type
validation happens at the endpoint, not in the schema.

C was rejected because it tries to have both A's flexibility and B's
structure, but ends up with two places to maintain when something
changes. The complexity isn't worth the marginal benefit.

### Connection model (why optional-typed, directed)

Considered: untyped/undirected, untyped/directed, typed/directed,
optional-typed/directed.

Chose optional-typed/directed because:
- Direction often matters (X leads to Y is not Y leads to X).
- Labels are valuable when present (gives structured world knowledge),
  but mandating them is friction.
- Making labels optional lets writers who care fill them in and writers
  who don't get simple arrows.

The label as freeform string (not enum) preserves writer freedom. If we
ever want to give Thad structured knowledge of relationships, we can
mine common labels and suggest them — but we don't restrict upfront.

### Provenance approach (why three values, always-create-new)

Three values (manual / ai / ai_edited) chosen because:
- It captures "where did this card come from" honestly.
- The `ai_edited` distinction matters because it tells future smart-merge
  features (if we ever build them) not to overwrite writer changes.
- Three values is the minimum that captures the real states without
  overengineering.

Always-create-new for re-extraction chosen because:
- Smart merge is a real feature with real UX (name matching, conflict
  resolution, writer-facing merge UI). It's its own project.
- v1 should ship without that complexity. The writer being responsible
  for cleanup is acceptable for a new feature.
- We warn the writer before re-extracting to make this behavior explicit.

### Canvas tech (why React Flow over tldraw)

React Flow chosen because:
- The data model is structured (cards + connections). React Flow speaks
  this natively. tldraw is more general-purpose and would require
  bending its primitives.
- Smaller API surface to learn. The build is hard enough without library
  complexity.
- Cards-as-nodes, connections-as-edges, drag-to-connect — all of these
  are React Flow's existing concepts.

tldraw scoped for a future "Sketchbook" feature instead — its hand-drawn
aesthetic and freeform drawing capabilities serve a different kind of
thinking (visual exploration vs structured organization). One tool per
purpose.

### Surface progression (why in-page → modal → window)

Considered: ship full-screen modal in v1; ship in-page in v1 and never
move; etc.

Chose v1 in-page, v1.1 modal, v1.2 window because:
- v1 in-page is the smallest buildable canvas that delivers value. Don't
  overshoot the first release.
- The data model and interaction model don't change across the three
  versions, so we're not painting ourselves into corners.
- Each upgrade is a real UX improvement that earns its own version
  number.
- Writers grow into the more sophisticated environment naturally — the
  v1 themed canvas is a familiar shape; the v1.1 modal feels like a
  meaningful "you've entered the world" moment; v1.2 unlocks dual-monitor
  workflow.

### Card types in v1 (why Character / Place / Note, not more)

Considered: ship five types (add Image, Link). Ship three types and add
more later (chosen).

Three types in v1 because:
- Character and Place are the highest-value structured types for
  fiction writers.
- Note is the catch-all that absorbs everything else.
- Image cards require image storage infrastructure that doesn't exist.
- Link cards require URL preview / OG metadata fetching for a good UX.
- Shipping three good card types beats shipping five mediocre ones.

---

## What we'll learn during build

This spec is the best we can do without code in front of us. The build
will surface things we couldn't anticipate. Revise the spec when that
happens; don't work around it.

Specifically, these are likely to need revisiting:

- **Auto-layout positions for AI-extracted cards.** "Soft grid" is the
  current intent, but the actual layout algorithm needs design work.
  Probably during the visual polish phase of the build.
- **The exact React Flow APIs for connection rendering.** We're committing
  to "lines with optional labels and arrow heads." The exact rendering
  shape gets settled when we see it in the browser.
- **Toolbar UX details.** "Bottom-center, three groups" is locked. The
  exact button shapes, spacings, icon choices, hover affordances all get
  decided during build.
- **The empty state copy.** Currently sketched as *"This is where your
  world lives. Add a card, or ask Thad to extract from a chapter."* That's
  a placeholder — voice-tune during build.
- **The "Send to canvas" interaction.** The single-step-with-flag API
  contract is locked; the exact UI flow (does the panel close? show a
  success state? animate to indicate the cards landed?) gets settled
  during build.

These are not gaps in the spec. They're explicit "to be settled in
context" items.

---

## Build sequence (when we get there)

For reference when scoping the implementation visits. Not part of the
spec proper, but the natural slicing of the work.

1. **Tech spike.** React Flow renders in the Publish Itt repo with a
   placeholder canvas. Two test nodes, one test edge, pan and zoom work.
   De-risk the technology. Single session.

2. **Backend foundation.** Models, endpoints, indexes, cascade integration.
   Add to `backend/test_delete_cascade.py`. Single visit, additive.

3. **Frontend route + empty canvas.** Add the route, the page shell,
   render an empty React Flow canvas, the toolbar (non-functional). Single
   visit.

4. **Card CRUD.** Create manual cards via the toolbar, render the three
   card types, edit/delete cards, persist positions. Single visit.

5. **Connections.** Draw connections between cards, edit labels, delete.
   Single visit.

6. **AI integration — Surface 1.** "Send to canvas" CTA in the Read/Analysis
   panel, the batch-create endpoint, materialize cards from analysis
   results. Single visit.

7. **AI integration — Surface 2.** Canvas-side Thad menu, chapter picker,
   trigger extraction from the canvas. Single visit.

8. **Polish.** Auto-layout for extracted cards, empty state, voice tuning,
   any visual refinements. Single visit.

Total: ~7-8 visits across backend and frontend. Each is independently
testable. Spread across however long is right.

---

## Glossary

For new readers (Claude Code on a future visit, future contributors).

- **Card.** A single item on the canvas. Has a type (Character / Place /
  Note), position, content, and provenance. Stored as one document in
  `worldbuilding_items`.
- **Connection.** A directional line between two cards. May have an
  optional label. Stored in `worldbuilding_connections`.
- **Provenance.** Where a card came from. One of `manual` (writer made
  it), `ai` (Thad extracted it, untouched), `ai_edited` (Thad extracted
  it, writer modified it).
- **Surface (1 / 2 / 3).** Where extraction can be triggered. Surface 1 =
  Read/Analysis panel inside a chapter. Surface 2 = canvas toolbar.
  Surface 3 = chapter sidebar context menu (v1.1+).
- **Extraction.** An AI action that produces cards from a chapter or the
  project as a whole. "Extract characters," "Apply Lantern Path," etc.
- **Type-aware splitting.** The decision of whether an analytical
  action's output becomes one card or many, made per action based on
  what the writer needs to do with the result.

---
