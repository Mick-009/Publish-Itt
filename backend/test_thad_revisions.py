"""
Stdlib-only smoke test for thad_revisions.py.

Run with: python test_thad_revisions.py

Does NOT hit MongoDB or any LLM — just verifies:
- module imports cleanly
- pydantic models construct correctly
- the prompt builder produces sane output
- the router builder runs without crashing
"""
import sys

# Stub fastapi if we don't have it on PYTHONPATH for the smoke test
try:
    import fastapi  # noqa
except ImportError:
    print("FAIL: fastapi not installed. Run inside the backend venv.")
    sys.exit(1)
try:
    import pydantic  # noqa
except ImportError:
    print("FAIL: pydantic not installed. Run inside the backend venv.")
    sys.exit(1)

import thad_revisions as tr


def test_models():
    """Models construct and serialize."""
    rev = tr.ThadRevision(
        project_id="proj-1",
        user_id="u-1",
        source_type="analysis",
        source_id="ch-1",
        user_feedback="too plot-focused",
        thad_response="Fair. Looking again, the issue is pacing.",
        previous_response="The plot is the issue here.",
    )
    d = rev.model_dump()
    assert d["project_id"] == "proj-1"
    assert d["source_type"] == "analysis"
    assert "id" in d and len(d["id"]) > 10
    assert "created_at" in d
    print("OK ThadRevision constructs")

    note = tr.ThadStyleNote(
        project_id="proj-1",
        user_id="u-1",
        note="Don't comment on dialogue tags. They're a stylistic choice.",
    )
    assert note.active is True
    assert note.source_revision_id is None
    print("OK ThadStyleNote constructs")

    req = tr.RegenerateRequest(
        source_type="analysis",
        source_id="ch-1",
        project_id="proj-1",
        user_feedback="missed the emotional core",
        previous_response='{"tone_analysis": "..."}',
    )
    assert req.user_feedback == "missed the emotional core"
    print("OK RegenerateRequest constructs")


def test_prompt_builder_basic():
    """Prompt builder produces expected sections."""
    prompt = tr.build_regen_prompt(
        previous_response='{"tone_analysis": "Stiff prose"}',
        user_feedback="You're missing the irony.",
        style_notes=[],
        source_type="analysis",
        chapter_content=None,
    )
    # Sanity checks on shape
    assert "pushback" in prompt.lower()
    assert "YOUR PREVIOUS RESPONSE" in prompt
    assert "Stiff prose" in prompt
    assert "WRITER'S PUSHBACK" in prompt
    assert "missing the irony" in prompt
    assert "JSON" in prompt  # we tell Thad to return JSON for analysis
    # Should NOT have a style-notes block since we passed []
    assert "Standing notes" not in prompt
    print("OK basic prompt — no style notes")


def test_prompt_builder_with_notes():
    """Style notes get injected in their own section."""
    prompt = tr.build_regen_prompt(
        previous_response='{"stage": "Draft"}',
        user_feedback="I'm further than draft.",
        style_notes=[
            "Don't comment on dialogue tags.",
            "This is literary fiction, not commercial.",
        ],
        source_type="workflow_recommendation",
        chapter_content=None,
    )
    assert "Standing notes" in prompt
    assert "dialogue tags" in prompt
    assert "literary fiction" in prompt
    print("OK prompt with style notes")


def test_prompt_builder_truncates_long_chapter():
    """Big chapter content gets clipped, not dumped whole."""
    big = "word " * 5000  # ~25k chars
    prompt = tr.build_regen_prompt(
        previous_response="...",
        user_feedback="...",
        style_notes=[],
        source_type="analysis",
        chapter_content=big,
    )
    assert "[...truncated]" in prompt
    # Should be under ~10k chars even with the big chapter
    assert len(prompt) < 12000
    print("OK long chapter truncated")


def test_router_builds():
    """build_router runs without raising. We don't hit the endpoints, just
    confirm wiring works."""
    class FakeDB:
        thad_revisions = None
        thad_style_notes = None
        projects = None

    def fake_get_user():
        return None

    async def fake_llm(system_prompt, user_prompt, want_json):
        return "fake"

    async def fake_fetch(project_id, source_id, user_id):
        return "fake content"

    router = tr.build_router(
        db=FakeDB(),
        get_current_user_dep=fake_get_user,
        call_llm_async=fake_llm,
        fetch_chapter_content_async=fake_fetch,
    )
    # The router should have all 6 routes registered
    paths = {r.path for r in router.routes}
    expected = {
        "/api/thad/regenerate",
        "/api/thad/revisions/{source_type}/{source_id}",
        "/api/thad/style-notes",
        "/api/thad/style-notes/{note_id}",
    }
    missing = expected - paths
    assert not missing, f"Missing routes: {missing}"
    print(f"OK router builds with {len(router.routes)} routes")


def main():
    test_models()
    test_prompt_builder_basic()
    test_prompt_builder_with_notes()
    test_prompt_builder_truncates_long_chapter()
    test_router_builds()
    print("\nAll smoke tests passed.")


if __name__ == "__main__":
    main()
