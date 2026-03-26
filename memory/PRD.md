# Publish Itt - Product Requirements Document

## Original Problem Statement

Build a private, in-house "Publish Itt" web app for managing books, chapters, publishing workflow, tone analysis, and art prompt generation. The application should feature a rich text editor, multiple workspaces for different tasks (Manuscript, Workflow, Tone & Style, Art Studio), and a dashboard to view all projects.

## Core Requirements

### User Personas

- **Primary User**: Authors managing multiple book projects
- **Use Case**: Writing, organizing, and refining manuscripts with AI assistance

### Core Screens

1. **Dashboard** - Project overview with quick actions
2. **Manuscript Workspace** - Rich text editor with chapter management
3. **Workflow Workspace** - Publishing pipeline visualization
4. **Tone & Style Workspace** - Tone analysis tools
5. **Art Studio** - AI art prompt generation
6. **Market Intelligence** - Market analysis and book idea generation
7. **Settings** - Style preset management

## Technology Stack

- **Frontend**: React, TailwindCSS, shadcn/ui, TipTap Editor
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **AI Integration**: OpenAI GPT-5.2 via Emergent LLM Key

## Data Models

### Primary Collections

- `projects` - Book projects (legacy, being migrated)
- `manuscripts_collection` - Unified manuscript records (new)
- `chapters` - Individual chapters with content
- `versions` - Content snapshots for version history
- `notes` - Notes and comments for chapters/manuscripts
- `style_presets` - Writing style configurations
- `art_assets` - Generated art assets
- `tone_profiles` - Tone analysis results

### Key Relationships

- Projects → Chapters (one-to-many)
- Chapters → Versions (one-to-many)
- Chapters → Notes (one-to-many)
- Manuscripts can have Versions and Notes directly

## Features Implemented

### Phase 1: Core Application ✅

- [x] Dashboard with project overview
- [x] Project CRUD operations
- [x] Chapter CRUD operations
- [x] Rich text editor (TipTap)
- [x] AI "Thad" assistant with context-aware prompts
- [x] Manuscript, Workflow, Tone & Style, Art Studio workspaces

### Phase 2: AI Integration ✅

- [x] Rewrite for Tone
- [x] Summarize Chapter
- [x] Generate Book Outline
- [x] Workflow Analysis
- [x] Tone Analysis
- [x] Art Prompt Generation
- [x] Ask Thad (general AI assistant)

### Phase 3: Market Intelligence ✅

- [x] Generate Book Ideas
- [x] Market Analysis
- [x] Customer Research
- [x] Market Outline Generation
- [x] Manuscript Draft Generation
- [x] Book Description Generation
- [x] Sales Analysis

### Phase 4: Manuscript Import ✅

- [x] File upload support (.txt, .docx, .pdf, .md)
- [x] Drag & drop functionality
- [x] Import preview
- [x] Import Analysis AI workflow
- [x] Implement/Ignore actions for suggestions

### Phase 5: Data Collections (Builder Mode) ✅ (Dec 31, 2025)

- [x] Manuscripts collection with CRUD API
- [x] Versions collection with CRUD API
- [x] Notes collection with CRUD API
- [x] Migration endpoint (projects → manuscripts)
- [x] Tabbed UI in Manuscript Workspace (Chapters | Versions | Notes)
- [x] Version snapshot creation
- [x] Version restore functionality
- [x] Note types (comment, todo, revision, author_intent)
- [x] Note CRUD with edit and delete

### Phase 6: Version Comparison ✅ (Dec 31, 2025)

- [x] Compare Mode toggle in Versions panel
- [x] Multi-version selection (select 2 versions)
- [x] Side-by-side diff view
- [x] Unified diff view
- [x] Word-level change highlighting (added/removed/unchanged)
- [x] Stats display (words added, removed, unchanged)
- [x] Automatic detection of older/newer versions

### Phase 7: Auto-Version Snapshots ✅ (Dec 31, 2025)

- [x] Auto-version toggle in editor toolbar
- [x] Automatic version snapshot after 10 minutes of editing
- [x] Visual indicator showing auto-version status
- [x] Toast notification when auto-save occurs
- [x] Auto-labeled versions with "Auto-save (timestamp)"
- [x] Content change detection to track editing activity

### Phase 8: Writing Statistics Dashboard ✅ (Jan 1, 2026)

- [x] Writing session tracking (words added/deleted, time spent)
- [x] Daily word count display with goal progress
- [x] Writing streak tracking (current and longest)
- [x] Weekly activity bar chart visualization
- [x] Summary statistics (total words, time, avg/day, days active)
- [x] Stats panel tab in AI sidebar with toggle
- [x] Automatic session logging every 5 minutes
- [x] Backend API endpoints for stats retrieval

### Phase 9: THADDAEUS Integration - Core (Jan 1, 2026) ✅

- [x] Global UI Style System with 5 color themes
- [x] Theme selection in Settings (Default, Evergreen Forest, Lantern Glow, Misty Morning, Campfire Warmth)
- [x] Theme persistence via localStorage
- [x] Descending order enforcement for Versions, Notes
- [x] THADDAEUS Analyzer panel with actionable buttons
- [x] Analyzer findings grouped by category (Structure, Formatting, Tone, Notes, Chapters, Issues)
- [x] Action buttons: Apply Change, Save to Notes, Dismiss
- [x] Re-analyze and Dismiss All functionality
- [x] 4-tab sidebar layout (Chapters, Versions, Notes, Analyze)

### Phase 10: Publish Itt Rebrand & Polish (Jan 4, 2026) ✅

- [x] Renamed app from "Author OS" to "Publish Itt"
- [x] Removed all legacy demo content references
- [x] Added comprehensive genre selection (60+ genres across 10 categories)
- [x] Added all reading age groups (Board Books to Adult)
- [x] Added 12 writing style options
- [x] Polished UI with modern, sleek design
- [x] Updated Dashboard header with branding
- [x] Enhanced New Book dialog with all metadata fields
- [x] Fixed scrolling issues in AI panel and sidebars

### Phase 11: Magic Import Wizard (THADDAEUS) (Jan 4, 2026) ✅

- [x] Auto-analysis triggers when Import Wizard dialog opens
- [x] AI analysis displays: word count, reading level, structure issues, notes detected
- [x] "Fix Everything Automatically" button runs autoformat, store_notes, split_chapters, full_qa
- [x] Version snapshots created: "Imported Raw", "Pre-FixEverything Backup", "FixEverything Applied"
- [x] Progress indicator during Fix Everything workflow
- [x] Completion screen with success/failure indicators per action
- [x] 10 individual action types: autoformat, remove_notes, store_notes, convert_notes, split_chapters, lantern_path, full_qa, extract_summaries, extract_characters, extract_glossary
- [x] Action result display with Implement/Ignore options
- [x] Notes extraction saves to Notes Collection
- [x] Full test coverage (13 backend tests passing)

### Phase 12: Chapter Detection & Splitting Enhancement (Jan 4, 2026) ✅

- [x] Fixed Analyzer panel "Analyze" button (was calling non-existent API)
- [x] Enhanced DOCX text extraction to include tables
- [x] Robust chapter detection supporting multiple formats:
  - CHAPTER 1, CHAPTER 1: Title, CHAPTER 1 — Title
  - Chapter One, Chapter Two (written numbers up to Twenty-Five)
  - CHAPTER I, II, III (Roman numerals)
  - Part 1, Part 2
  - Prologue, Epilogue, Introduction, Foreword
- [x] Split chapters integrated into "Fix Everything Automatically" workflow
- [x] Chapters preview shown in Import Analysis (count + markers)
- [x] Detailed logging for debugging import issues
- [x] All 13 chapters correctly detected and created from user's DOCX manuscript

### Phase 13: Rewrite for Tone Apply/Deny (Jan 4, 2026) ✅

- [x] Added Apply/Deny buttons for "Rewrite for Tone" AI suggestions
- [x] Apply button: Creates version backup ("Before Tone Rewrite"), replaces editor content, shows success toast
- [x] Deny button: Dismisses suggestion, clears AI panel, shows info toast
- [x] Response type tracking (rewrite, summarize, outline) for conditional UI
- [x] Styled suggestion box with label "Suggested Rewrite"
- [x] Dismiss button for non-rewrite AI responses

### Phase 14: Thad Onboarding & Tour (Jan 6-8, 2026) ✅

- [x] Multi-step onboarding flow with Thad persona
- [x] Guided tour with highlight targets
- [x] "Reset Onboarding" button in Settings
- [x] Tour can be restarted from Settings

### Phase 15: Advanced Modules (Jan 6-8, 2026) ✅

- [x] Workflow Tab - AI-powered workflow stage analysis (Idea Drop → Outline → Draft → Revise → Polish → Complete)
- [x] Enhanced Tone & Style Analysis - Structured analysis cards for Tone, Style, and Suggestions
- [x] Writing Momentum Summary - AI-generated summary based on writing statistics
- [x] Daily Goals System - User-set word/time goals with auto-reset at midnight
- [x] Book Art Profile - Visual identity definition (genre, mood, art style, color palette)
- [x] Scene-to-Art Prompt Generation - Extract visually rich scenes and generate structured art prompts

### Phase 16: Implement Changes Backend Logic (Jan 8, 2026) ✅

- [x] POST /api/ai/import/implement endpoint for applying Magic Import Wizard actions
- [x] autoformat action - AI cleans content and updates chapter in database
- [x] remove_notes action - AI removes inline notes and updates chapter
- [x] store_notes action - Creates Note records from extracted_notes array
- [x] convert_notes action - Categorizes notes into chapter_notes/revision_notes/author_intent
- [x] Version snapshots created before content changes
- [x] Word count recalculated after content updates
- [x] Frontend ImportAnalysisDialog updated to call implement endpoint
- [x] Full test coverage (16 additional tests passing)

### Phase 17: Data Model Unification, Image Generation & Export (Jan 9, 2026) ✅

- [x] Data Model Unification - Deprecated manuscripts_collection endpoints with warning logs
- [x] Added genre, age_group, writing_style fields to Project model
- [x] Frontend API deprecation warnings with console.warn()
- [x] AI Image Generation - POST /api/ai/generate-image using OpenAI gpt-image-1
- [x] Image size options: 1024x1024, 1536x1024 (landscape), 1024x1536 (portrait)
- [x] Art Studio UI for generating actual images from prompts
- [x] Image download functionality with proper filename
- [x] Export to DOCX - POST /api/export/docx with python-docx
- [x] Export to PDF - POST /api/export/pdf with fpdf2
- [x] Export options: include title page, include chapter numbers
- [x] Export dialog in ManuscriptWorkspace with format selection
- [x] Unicode character sanitization for PDF generation
- [x] Full test coverage (20 additional tests passing, 100% success)

## API Endpoints

### Projects

- `GET/POST /api/projects` - List/Create projects
- `GET/PUT/DELETE /api/projects/{id}` - Single project operations

### Chapters

- `GET /api/chapters/project/{project_id}` - Chapters by project
- `GET/POST /api/chapters` - Chapter CRUD
- `PUT/DELETE /api/chapters/{id}` - Update/Delete chapter

### Manuscripts Collection (DEPRECATED - Use Projects)

- `GET/POST /api/manuscripts-collection` - List/Create (deprecated)
- `GET/PUT/DELETE /api/manuscripts-collection/{id}` - Single manuscript (deprecated)
- `GET /api/manuscripts-collection/{id}/chapters` - Chapters by manuscript (deprecated)

### Export

- `POST /api/export/docx` - Export project to Microsoft Word format
- `POST /api/export/pdf` - Export project to PDF format

### Versions

- `POST /api/versions` - Create version snapshot
- `GET /api/versions/parent/{type}/{id}` - Versions by parent
- `GET /api/versions/{id}` - Get version
- `DELETE /api/versions/{id}` - Delete version

### Notes

- `POST /api/notes` - Create note
- `GET /api/notes/parent/{type}/{id}` - Notes by parent
- `GET/PUT/DELETE /api/notes/{id}` - Single note operations

### AI Endpoints

- `POST /api/ai/rewrite` - Rewrite for tone
- `POST /api/ai/summarize` - Summarize content
- `POST /api/ai/outline` - Generate outline
- `POST /api/ai/workflow-analysis` - Analyze workflow
- `POST /api/ai/analyze-tone` - Tone analysis
- `POST /api/ai/art-prompts` - Generate art prompts
- `POST /api/ai/generate-image` - Generate image from prompt (OpenAI)
- `POST /api/ai/ask-thad` - General AI query
- `POST /api/ai/import/analyze` - Import analysis
- `POST /api/ai/import/action` - Execute import action
- `POST /api/ai/import/implement` - Implement changes to chapter content
- `POST /api/ai/market/*` - Market intelligence endpoints

### Upload

- `POST /api/manuscripts/upload` - Upload manuscript
- `POST /api/manuscripts/upload-preview` - Preview upload
- `POST /api/actions/import-manuscript` - Import to manuscripts collection

### Migration

- `POST /api/migrate/projects-to-manuscripts` - Migrate projects to manuscripts

## Outstanding Tasks

### P1 - High Priority

- All P1 tasks completed!

### P2 - Medium Priority

- [ ] Implement collaborative editing support
- [ ] Add analytics dashboard for writing progress

### P3 - Low Priority

- [ ] Custom notifications/nudges for writing goals
- [ ] Lantern Path mapping and analysis
- [ ] Style selection dropdown for "Rewrite for Tone" (e.g., Professional, Playful)
- [ ] Merge Chapters feature
- [ ] Style Conversion feature (deferred by user)
- [ ] Dark/light theme toggle
- [ ] Keyboard shortcuts
- [ ] Mobile responsive improvements

## Known Issues

- Console warnings for controlled/uncontrolled Select components (cosmetic)
- ProseMirror CSS white-space warning (cosmetic)
- ESLint warnings for useEffect dependencies (code quality)

## Test Coverage

- Backend: 86+ tests passing (100%) - includes export, image gen, and deprecated endpoint tests
- Frontend: All core features tested and working

## 3rd Party Integrations

- **OpenAI GPT** - Text generation via Emergent LLM Key
- **OpenAI Image Generation** - gpt-image-1 via Emergent LLM Key

---

_Last Updated: January 9, 2026_
