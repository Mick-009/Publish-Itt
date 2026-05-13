"""
Smoke test for the export module.

Runs without any external dependencies. Produces:
  - sample.md
  - sample.epub

Then it pokes at both to confirm they're structurally valid:
  - Markdown: presence of YAML front-matter, chapter headings, body text
  - EPUB: zip structure, mimetype first and uncompressed, required files
    present, OPF parses as XML, nav parses as XML

If anything fails it raises AssertionError with a clear message.
"""

import os
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

# Make the exports module importable.
sys.path.insert(0, str(Path(__file__).parent))
from exports import build_markdown, build_epub, parse_blocks, safe_filename


# ── Sample data that mirrors what the real backend would pass in ────────────

SAMPLE_PROJECT = {
    "id": "test-project-1",
    "title": "The Quiet Forest",
    "series_name": "Lantern Tales",
    "summary": (
        "A short novel about a boy who notices what the rest of the village "
        "has stopped seeing. The first in a planned sequence."
    ),
    "word_count": 1234,
}

SAMPLE_CHAPTERS = [
    {
        "id": "ch1",
        "chapter_number": 1,
        "title": "The Path In",
        "content": (
            "<p>The air felt strangely quiet.</p>"
            "<p>He stood for a moment, scanning the trees. <strong>Too quiet.</strong></p>"
            "<h2>A clearing</h2>"
            "<p>Then he saw it — a single piece of bark, <em>wedged under a stone</em>.</p>"
            "<blockquote>Some things are easy to miss until you stop looking for them.</blockquote>"
            "<p>He lifted it with care.</p>"
            "<hr/>"
            "<p>The light moved.</p>"
        ),
    },
    {
        "id": "ch2",
        "chapter_number": 2,
        "title": "What He Brought Back",
        "content": (
            "<p>He took the bark home, and put it on the table near the lantern.</p>"
            "<ul>"
            "<li>The cat ignored it.</li>"
            "<li>His mother frowned at it.</li>"
            "<li>His brother said nothing.</li>"
            "</ul>"
            "<p>Three reactions, three answers.</p>"
        ),
    },
    {
        "id": "ch3",
        "chapter_number": 3,
        "title": "",  # Test missing title
        "content": "<p>The story continues, even if the chapter has no name.</p>",
    },
]

AUTHOR = "Mick Calhoun"


# ── Block parser sanity check ────────────────────────────────────────────────

def test_parse_blocks():
    print("→ parse_blocks")
    blocks = parse_blocks(SAMPLE_CHAPTERS[0]["content"])
    types = [b["type"] for b in blocks]
    print(f"  block types: {types}")

    # Must have all the expected block types in the right order.
    expected_subsequence = ["p", "p", "h", "p", "blockquote", "p", "hr", "p"]
    assert types == expected_subsequence, f"Expected {expected_subsequence}, got {types}"

    # Headings carry level.
    heading = next(b for b in blocks if b["type"] == "h")
    assert heading["level"] == 2, f"Expected h2, got h{heading['level']}"
    assert heading["text"] == "A clearing"

    # List parsing on chapter 2.
    blocks2 = parse_blocks(SAMPLE_CHAPTERS[1]["content"])
    ul = next((b for b in blocks2 if b["type"] == "ul"), None)
    assert ul is not None, "Expected to find a <ul> block"
    assert len(ul["items"]) == 3, f"Expected 3 list items, got {len(ul['items'])}"
    assert ul["items"][0] == "The cat ignored it."

    print("  OK")


# ── Markdown export ──────────────────────────────────────────────────────────

def test_markdown():
    print("→ build_markdown")
    md_bytes = build_markdown(SAMPLE_PROJECT, SAMPLE_CHAPTERS, AUTHOR)
    assert isinstance(md_bytes, bytes), "Expected bytes"

    md = md_bytes.decode("utf-8")

    # YAML front-matter
    assert md.startswith("---\n"), "Markdown should start with YAML front-matter"
    assert "title: The Quiet Forest" in md, "Title not in front-matter"
    assert f"author: {AUTHOR}" in md, "Author not in front-matter"

    # Chapter headings
    assert "# Chapter 1: The Path In" in md
    assert "# Chapter 2: What He Brought Back" in md
    # Chapter 3 has no title; should fall back to "Chapter 3"
    assert "# Chapter 3\n" in md, "Empty-title chapter should fall back to just 'Chapter 3'"
    assert "# Chapter 3: Chapter 3" not in md, "Should not double up the chapter label"

    # Body text and Markdown elements
    assert "## A clearing" in md, "h2 should become ##"
    assert "> Some things are easy" in md, "blockquote should use >"
    assert "- The cat ignored it." in md, "ul should use -"
    assert "---" in md, "hr should render"

    # Write to disk for visual review
    out_path = Path(__file__).parent / "sample.md"
    out_path.write_bytes(md_bytes)
    print(f"  wrote {out_path} ({len(md_bytes)} bytes)")
    print("  OK")


# ── EPUB export ──────────────────────────────────────────────────────────────

def test_epub_no_cover():
    print("→ build_epub (no cover)")
    epub_bytes = build_epub(SAMPLE_PROJECT, SAMPLE_CHAPTERS, AUTHOR)
    assert isinstance(epub_bytes, bytes)

    out_path = Path(__file__).parent / "sample.epub"
    out_path.write_bytes(epub_bytes)
    print(f"  wrote {out_path} ({len(epub_bytes)} bytes)")

    # Validate zip structure.
    with zipfile.ZipFile(out_path, "r") as zf:
        names = zf.namelist()
        print(f"  entries: {names}")

        # mimetype must be the first entry and must be uncompressed.
        first = zf.infolist()[0]
        assert first.filename == "mimetype", f"First entry must be 'mimetype', got {first.filename}"
        assert first.compress_type == zipfile.ZIP_STORED, "mimetype must be ZIP_STORED"
        assert zf.read("mimetype") == b"application/epub+zip"

        # Required files
        required = {
            "mimetype",
            "META-INF/container.xml",
            "OEBPS/content.opf",
            "OEBPS/nav.xhtml",
            "OEBPS/stylesheet.css",
            "OEBPS/title.xhtml",
            "OEBPS/chapter-0001.xhtml",
            "OEBPS/chapter-0002.xhtml",
            "OEBPS/chapter-0003.xhtml",
        }
        missing = required - set(names)
        assert not missing, f"Missing required EPUB files: {missing}"

        # No cover should be present.
        assert not any(n.startswith("OEBPS/cover.") for n in names), \
            "Did not expect a cover file in the no-cover test"

        # container.xml parses as XML
        container = zf.read("META-INF/container.xml").decode("utf-8")
        ET.fromstring(container)

        # OPF parses as XML and contains expected metadata.
        opf = zf.read("OEBPS/content.opf").decode("utf-8")
        opf_tree = ET.fromstring(opf)
        assert "The Quiet Forest" in opf, "Title missing from OPF"
        assert AUTHOR in opf, "Author missing from OPF"

        # Nav doc parses and has all three chapters in the ToC
        nav = zf.read("OEBPS/nav.xhtml").decode("utf-8")
        ET.fromstring(nav)
        assert "Chapter 1: The Path In" in nav
        assert "Chapter 2: What He Brought Back" in nav

        # Chapter XHTML parses as XML
        ch1 = zf.read("OEBPS/chapter-0001.xhtml").decode("utf-8")
        ET.fromstring(ch1)
        # The h2 from the source should be preserved as h2
        assert "<h2>A clearing</h2>" in ch1, "h2 should be preserved in EPUB chapter"
        # The blockquote should render as a blockquote
        assert "<blockquote>" in ch1, "blockquote missing"
        # The scene break should render as our styled hr
        assert 'class="scene-break"' in ch1, "hr should have scene-break class"

        # List in chapter 2
        ch2 = zf.read("OEBPS/chapter-0002.xhtml").decode("utf-8")
        ET.fromstring(ch2)
        assert "<ul>" in ch2 and "<li>The cat ignored it.</li>" in ch2

    print("  OK")


def test_epub_with_cover():
    print("→ build_epub (with cover)")
    # Minimal valid JPEG (1x1 white pixel). This is enough to exercise the
    # cover code path; readers don't actually validate the image bytes.
    fake_jpeg = bytes.fromhex(
        "ffd8ffe000104a46494600010101006000600000ffdb004300080606"
        "070605080707070909080a0c140d0c0b0b0c1912130f141d1a1f1e1d"
        "1a1c1c20242e2720222c231c1c2837292c30313434341f27393d3832"
        "3c2e333432ffdb0043010909090c0b0c180d0d1832211c213232323232"
        "3232323232323232323232323232323232323232323232323232323232"
        "3232323232323232323232323232323232ffc0001108000100010301"
        "2200021101031101ffc4001f0000010501010101010100000000000000"
        "000102030405060708090a0bffc400b5100002010303020403050504040000"
        "017d01020300041105122131410613516107227114328191a1082342b1c11552d1f02433627282090a161718191a25262728292a3435363738393a434445464748494a535455565758595a636465666768696a737475767778797a838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae1e2e3e4e5e6e7e8e9eaf1f2f3f4f5f6f7f8f9faffc4001f0100030101010101010101010000000000000102030405060708090a0bffc400b51100020102040403040705040400010277000102031104052131061241510761711322328108144291a1b1c109233352f0156272d10a162434e125f11718191a262728292a35363738393a434445464748494a535455565758595a636465666768696a737475767778797a82838485868788898a92939495969798999aa2a3a4a5a6a7a8a9aab2b3b4b5b6b7b8b9bac2c3c4c5c6c7c8c9cad2d3d4d5d6d7d8d9dae2e3e4e5e6e7e8e9eaf2f3f4f5f6f7f8f9faffda000c03010002110311003f00fbfcffd9"
    )

    epub_bytes = build_epub(
        SAMPLE_PROJECT,
        SAMPLE_CHAPTERS,
        AUTHOR,
        cover_bytes=fake_jpeg,
        cover_media_type="image/jpeg",
    )

    out_path = Path(__file__).parent / "sample_with_cover.epub"
    out_path.write_bytes(epub_bytes)
    print(f"  wrote {out_path} ({len(epub_bytes)} bytes)")

    with zipfile.ZipFile(out_path, "r") as zf:
        names = zf.namelist()

        # Cover image and cover page both present
        assert "OEBPS/cover.jpg" in names, "Cover image missing"
        assert "OEBPS/cover.xhtml" in names, "Cover page missing"

        # OPF should mark the cover image with properties="cover-image"
        opf = zf.read("OEBPS/content.opf").decode("utf-8")
        assert 'properties="cover-image"' in opf, "Cover image not flagged in OPF manifest"
        assert 'name="cover"' in opf, "Cover meta tag missing in OPF"

        # Cover should be the first item in the spine.
        # Quick string check rather than full XML parse.
        cover_idx = opf.find('idref="cover"')
        title_idx = opf.find('idref="title-page"')
        assert cover_idx != -1, "Cover not in spine"
        assert cover_idx < title_idx, "Cover should come before title page in spine"

    print("  OK")


def test_safe_filename():
    print("→ safe_filename")
    assert safe_filename("The Quiet Forest", "epub") == "The_Quiet_Forest.epub"
    assert safe_filename("Title: With Colons!", "md") == "Title_With_Colons.md"
    assert safe_filename("", "pdf") == "manuscript.pdf"
    long_title = "x" * 100
    result = safe_filename(long_title, "epub")
    assert len(result) <= 55, f"Filename too long: {len(result)}"
    print("  OK")


# ── Run ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    test_parse_blocks()
    test_markdown()
    test_epub_no_cover()
    test_epub_with_cover()
    test_safe_filename()
    print()
    print("All tests passed.")
