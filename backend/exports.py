"""
Publish Itt — Export module.

All export logic lives here so `server.py` stays focused on routes.

Currently exports:
  - Markdown (.md)
  - EPUB 3 (.epub) — built from scratch using stdlib zipfile/xml, no
    third-party EPUB library. Keeps the dependency surface small and
    makes the format easy to tweak.

DOCX and PDF still live in `server.py` since they're already there;
folding them in here is a later cleanup.

Public entry points:
  build_markdown(project, chapters, author, options) -> bytes
  build_epub(project, chapters, author, options, cover_bytes=None) -> bytes

Both return bytes ready to stream back as a file download.
"""

from __future__ import annotations

import io
import re
import uuid
import zipfile
from datetime import datetime, timezone
from html import escape as html_escape
from typing import Optional
from xml.sax.saxutils import escape as xml_escape


# ── HTML → plain-ish conversion ──────────────────────────────────────────────
#
# The Tiptap editor stores content as HTML. For Markdown we want a reasonable
# Markdown rendering; for EPUB we want clean XHTML. The two share a lot, so we
# normalise once into a small intermediate representation (a list of "blocks"
# where each block is a dict of {type, content, level?}) and then render that
# representation per format.
#
# We deliberately don't use BeautifulSoup or lxml here — the editor's output is
# constrained enough that a small regex-based parser handles it faithfully, and
# we avoid pulling another dependency into the request path.


_BLOCK_TAG_RE = re.compile(
    r"<(?P<tag>p|h1|h2|h3|h4|h5|h6|blockquote|ul|ol|li|hr|br)\b[^>]*>"
    r"(?P<body>.*?)"
    r"</(?P=tag)>",
    re.IGNORECASE | re.DOTALL,
)

# A second pass for void-style tags that don't have a closing tag.
_VOID_TAG_RE = re.compile(r"<(?P<tag>br|hr)\s*/?>", re.IGNORECASE)


def _decode_entities(text: str) -> str:
    """Decode the small set of HTML entities the editor emits."""
    if not text:
        return ""
    replacements = {
        "&nbsp;": " ",
        "&amp;": "&",
        "&lt;": "<",
        "&gt;": ">",
        "&quot;": '"',
        "&#39;": "'",
        "&apos;": "'",
        "&hellip;": "…",
        "&mdash;": "—",
        "&ndash;": "–",
        "&lsquo;": "\u2018",
        "&rsquo;": "\u2019",
        "&ldquo;": "\u201c",
        "&rdquo;": "\u201d",
    }
    for entity, char in replacements.items():
        text = text.replace(entity, char)
    # Numeric entities.
    text = re.sub(
        r"&#(\d+);",
        lambda m: chr(int(m.group(1))) if int(m.group(1)) < 0x110000 else m.group(0),
        text,
    )
    return text


def _strip_inline_tags(text: str, mode: str) -> str:
    """
    Convert inline tags inside a block. `mode` selects the output:
      - "markdown" — emit Markdown emphasis
      - "xhtml"    — preserve emphasis tags, sanitise the rest
      - "plain"    — strip all tags, return bare text
    """
    if not text:
        return ""

    # Drop any tags we don't understand entirely, but preserve their content.
    # Inline tags we care about: strong/b, em/i, br.

    if mode == "markdown":
        text = re.sub(r"<(strong|b)\b[^>]*>(.*?)</\1>", r"**\2**", text, flags=re.IGNORECASE | re.DOTALL)
        text = re.sub(r"<(em|i)\b[^>]*>(.*?)</\1>", r"*\2*", text, flags=re.IGNORECASE | re.DOTALL)
        text = re.sub(r"<code\b[^>]*>(.*?)</code>", r"`\1`", text, flags=re.IGNORECASE | re.DOTALL)
        text = re.sub(r"<br\s*/?>", "  \n", text, flags=re.IGNORECASE)
        text = re.sub(r"<[^>]+>", "", text)
        text = _decode_entities(text)
        return text.strip()

    if mode == "xhtml":
        # Normalise <b>/<i> to <strong>/<em> for EPUB cleanliness.
        text = re.sub(r"<b\b([^>]*)>", r"<strong\1>", text, flags=re.IGNORECASE)
        text = re.sub(r"</b>", "</strong>", text, flags=re.IGNORECASE)
        text = re.sub(r"<i\b([^>]*)>", r"<em\1>", text, flags=re.IGNORECASE)
        text = re.sub(r"</i>", "</em>", text, flags=re.IGNORECASE)
        # Make <br> self-closing for XHTML.
        text = re.sub(r"<br\s*/?>", "<br/>", text, flags=re.IGNORECASE)
        # Strip anything else (tiptap occasionally emits spans with style attrs).
        text = re.sub(r"</?(?!strong\b|em\b|br\b|code\b)[a-zA-Z][^>]*>", "", text)
        text = _decode_entities(text)
        return text.strip()

    # plain
    text = re.sub(r"<br\s*/?>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    text = _decode_entities(text)
    return text.strip()


def parse_blocks(html: str) -> list[dict]:
    """
    Parse the editor's HTML into a list of typed blocks.

    Each block is one of:
      {"type": "p",          "text": "..."}
      {"type": "h",  "level": 1-6, "text": "..."}
      {"type": "blockquote", "text": "..."}
      {"type": "ul",         "items": ["..."]}
      {"type": "ol",         "items": ["..."]}
      {"type": "hr"}

    Anything we can't parse becomes a paragraph so nothing is lost.
    """
    if not html or not html.strip():
        return []

    # If the editor returned raw text without tags, treat double-newlines as
    # paragraph breaks. Tiptap normally wraps, but defensive.
    if "<" not in html:
        return [
            {"type": "p", "text": _decode_entities(p.strip())}
            for p in html.split("\n\n")
            if p.strip()
        ]

    blocks: list[dict] = []

    # Normalise lists separately — they're block-level but their <li>s are
    # nested, so the flat regex below would emit them as well. Pull them out
    # first.
    list_pattern = re.compile(
        r"<(?P<tag>ul|ol)\b[^>]*>(?P<body>.*?)</(?P=tag)>",
        re.IGNORECASE | re.DOTALL,
    )

    def _extract_list(match: re.Match) -> str:
        tag = match.group("tag").lower()
        items = re.findall(
            r"<li\b[^>]*>(.*?)</li>", match.group("body"), re.IGNORECASE | re.DOTALL
        )
        placeholder = f"\x00LIST{len(blocks)}\x00"
        blocks.append(
            {
                "type": tag,
                "items": [_strip_inline_tags(item, "plain") for item in items if item.strip()],
            }
        )
        return placeholder

    html_with_placeholders = list_pattern.sub(_extract_list, html)

    # Now walk the remaining block-level tags in document order.
    # We do this by finding each match and tracking position, so we keep
    # order even when blocks are mixed with placeholders.
    pieces: list[tuple[int, dict]] = []

    for match in _BLOCK_TAG_RE.finditer(html_with_placeholders):
        tag = match.group("tag").lower()
        body = match.group("body")
        pos = match.start()

        if tag == "p":
            text = _strip_inline_tags(body, "plain")
            if text:
                pieces.append((pos, {"type": "p", "text": text}))
        elif tag in ("h1", "h2", "h3", "h4", "h5", "h6"):
            text = _strip_inline_tags(body, "plain")
            if text:
                pieces.append((pos, {"type": "h", "level": int(tag[1]), "text": text}))
        elif tag == "blockquote":
            text = _strip_inline_tags(body, "plain")
            if text:
                pieces.append((pos, {"type": "blockquote", "text": text}))
        elif tag == "hr":
            pieces.append((pos, {"type": "hr"}))
        # ul/ol/li were already handled by the placeholder pass.
        # br as a block tag is exotic; skip.

    # Insert list placeholders back at the right positions.
    placeholder_re = re.compile(r"\x00LIST(\d+)\x00")
    for match in placeholder_re.finditer(html_with_placeholders):
        idx = int(match.group(1))
        pieces.append((match.start(), blocks[idx]))

    # Standalone <hr/> outside the closing-tag pattern.
    for match in re.finditer(r"<hr\s*/?>", html_with_placeholders, re.IGNORECASE):
        pieces.append((match.start(), {"type": "hr"}))

    pieces.sort(key=lambda item: item[0])
    return [piece for _, piece in pieces]


# ── Markdown export ──────────────────────────────────────────────────────────


def _render_block_markdown(block: dict) -> str:
    btype = block["type"]
    if btype == "p":
        return block["text"]
    if btype == "h":
        return f"{'#' * block['level']} {block['text']}"
    if btype == "blockquote":
        return "\n".join(f"> {line}" for line in block["text"].split("\n"))
    if btype == "ul":
        return "\n".join(f"- {item}" for item in block["items"])
    if btype == "ol":
        return "\n".join(f"{i+1}. {item}" for i, item in enumerate(block["items"]))
    if btype == "hr":
        return "---"
    return block.get("text", "")


def build_markdown(
    project: dict,
    chapters: list[dict],
    author: str,
    include_title_page: bool = True,
    include_chapter_numbers: bool = True,
) -> bytes:
    """
    Render the manuscript as a Markdown document.

    The output is a single file with YAML front-matter (title, author, date),
    an optional title page, and chapters as level-1 headings.
    """
    out: list[str] = []

    title = project.get("title") or "Untitled"
    summary = project.get("summary") or ""
    series_name = project.get("series_name") or ""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    # YAML front-matter — Pandoc and Obsidian both read this.
    out.append("---")
    out.append(f"title: {_yaml_safe(title)}")
    if author:
        out.append(f"author: {_yaml_safe(author)}")
    out.append(f"date: {today}")
    if series_name:
        out.append(f"series: {_yaml_safe(series_name)}")
    out.append("---")
    out.append("")

    if include_title_page:
        out.append(f"# {title}")
        out.append("")
        if author:
            out.append(f"*by {author}*")
            out.append("")
        if series_name:
            out.append(f"Part of *{series_name}*")
            out.append("")
        if summary:
            out.append(summary)
            out.append("")
        # Page break is a Markdown nicety — many readers honor `\newpage` but
        # none break on plain Markdown. Two blank lines is the best we can do.
        out.append("")

    for chapter in chapters:
        chapter_title = (chapter.get("title") or "").strip()
        chapter_num = chapter.get("chapter_number", "?")
        if chapter_title and include_chapter_numbers:
            heading = f"Chapter {chapter_num}: {chapter_title}"
        elif chapter_title:
            heading = chapter_title
        else:
            heading = f"Chapter {chapter_num}"

        out.append(f"# {heading}")
        out.append("")

        blocks = parse_blocks(chapter.get("content", ""))
        if not blocks:
            out.append("")
            continue

        for block in blocks:
            # For Markdown we want inline emphasis preserved, so re-run on the
            # block text via the inline converter in markdown mode.
            if block["type"] in ("p", "h", "blockquote"):
                # parse_blocks returned plain text; re-extract inline marks from
                # the original by walking again — simpler approach is to keep a
                # markdown-emphasised version. To stay simple, we run the inline
                # converter on the block's text re-wrapped, which is a no-op for
                # already-plain text. Tradeoff: we lose bold/italic in this path.
                # Acceptable for v1; a future pass can preserve inline marks
                # through parse_blocks.
                pass
            out.append(_render_block_markdown(block))
            out.append("")

    # Trim trailing blanks.
    while out and out[-1] == "":
        out.pop()
    out.append("")

    return "\n".join(out).encode("utf-8")


def _yaml_safe(value: str) -> str:
    """Quote a YAML scalar if needed."""
    if value is None:
        return '""'
    if re.search(r"[:#{}\[\],&*!|>'\"%@`]", value) or value != value.strip():
        # Escape inner double quotes and wrap.
        return '"' + value.replace('\\', '\\\\').replace('"', '\\"') + '"'
    return value


# ── EPUB export ──────────────────────────────────────────────────────────────
#
# EPUB 3 is a zip file with this structure:
#
#   mimetype                       (stored, not compressed — must be first entry)
#   META-INF/
#     container.xml                (points at the OPF package file)
#   OEBPS/
#     content.opf                  (package — metadata + manifest + spine)
#     nav.xhtml                    (table of contents — required in EPUB 3)
#     stylesheet.css               (optional)
#     cover.xhtml                  (optional cover page)
#     cover.jpg                    (optional cover image)
#     title.xhtml                  (title page)
#     chapter-0001.xhtml           (one per chapter)
#     ...
#
# Reference: https://www.w3.org/publishing/epub3/epub-packages.html


_EPUB_CSS = """\
@charset "utf-8";

body {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 1em;
  line-height: 1.55;
  margin: 1em;
  text-align: justify;
  hyphens: auto;
}

h1, h2, h3, h4, h5, h6 {
  font-family: Georgia, "Times New Roman", serif;
  font-weight: normal;
  text-align: center;
  page-break-before: always;
  margin-top: 2em;
  margin-bottom: 1.5em;
}

h1 { font-size: 1.8em; }
h2 { font-size: 1.4em; }
h3 { font-size: 1.2em; }

p {
  text-indent: 1.5em;
  margin: 0;
}

p:first-of-type,
h1 + p,
h2 + p,
h3 + p,
blockquote + p {
  text-indent: 0;
}

blockquote {
  margin: 1em 2em;
  font-style: italic;
}

hr.scene-break {
  border: none;
  text-align: center;
  margin: 1.5em 0;
}

hr.scene-break::after {
  content: "* * *";
  letter-spacing: 0.5em;
}

.title-page {
  text-align: center;
  padding-top: 30%;
}

.title-page h1 {
  page-break-before: avoid;
  margin-bottom: 1em;
}

.title-page .author {
  font-style: italic;
  margin-top: 2em;
}

.title-page .series {
  margin-top: 1em;
  font-size: 0.9em;
  color: #555;
}
"""


def _render_block_xhtml(block: dict) -> str:
    btype = block["type"]
    if btype == "p":
        text = _strip_inline_tags(_re_wrap_inline(block["text"]), "xhtml")
        return f"<p>{text}</p>"
    if btype == "h":
        level = max(1, min(6, block["level"]))
        text = xml_escape(block["text"])
        return f"<h{level}>{text}</h{level}>"
    if btype == "blockquote":
        text = xml_escape(block["text"])
        return f"<blockquote><p>{text}</p></blockquote>"
    if btype == "ul":
        items = "".join(f"<li>{xml_escape(i)}</li>" for i in block["items"])
        return f"<ul>{items}</ul>"
    if btype == "ol":
        items = "".join(f"<li>{xml_escape(i)}</li>" for i in block["items"])
        return f"<ol>{items}</ol>"
    if btype == "hr":
        return '<hr class="scene-break"/>'
    return ""


def _re_wrap_inline(text: str) -> str:
    """
    parse_blocks strips inline tags to plain text. For XHTML we want to keep
    emphasis. Since we already lost it at parse time, this is a placeholder
    that just escapes the plain text properly. A future pass can preserve
    inline marks through parse_blocks; for v1, plain paragraphs are fine for
    EPUB readability.
    """
    return xml_escape(text)


def _xhtml_chapter(title: str, body: str, language: str = "en") -> str:
    return f"""<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="{language}" lang="{language}">
<head>
  <meta charset="utf-8"/>
  <title>{xml_escape(title)}</title>
  <link rel="stylesheet" type="text/css" href="stylesheet.css"/>
</head>
<body>
{body}
</body>
</html>
"""


def _xhtml_title_page(project: dict, author: str) -> str:
    title = xml_escape(project.get("title") or "Untitled")
    series = project.get("series_name") or ""
    summary = project.get("summary") or ""

    parts = ['<div class="title-page">', f"<h1>{title}</h1>"]
    if author:
        parts.append(f'<p class="author">by {xml_escape(author)}</p>')
    if series:
        parts.append(f'<p class="series">Part of {xml_escape(series)}</p>')
    if summary:
        parts.append(f"<p>{xml_escape(summary)}</p>")
    parts.append("</div>")
    return _xhtml_chapter(project.get("title") or "Untitled", "\n".join(parts))


def _xhtml_cover_page(cover_filename: str) -> str:
    body = f"""<div style="text-align:center;page-break-after:always;">
  <img src="{cover_filename}" alt="Cover" style="max-width:100%;height:auto;"/>
</div>"""
    return _xhtml_chapter("Cover", body)


def _xhtml_chapter_body(chapter: dict, include_chapter_numbers: bool) -> tuple[str, str]:
    """Return (xhtml content, heading text used for ToC)."""
    chapter_title = (chapter.get("title") or "").strip()
    chapter_num = chapter.get("chapter_number", "?")
    if chapter_title and include_chapter_numbers:
        heading = f"Chapter {chapter_num}: {chapter_title}"
    elif chapter_title:
        heading = chapter_title
    else:
        heading = f"Chapter {chapter_num}"

    blocks = parse_blocks(chapter.get("content", ""))
    rendered = [f"<h1>{xml_escape(heading)}</h1>"]
    rendered.extend(_render_block_xhtml(b) for b in blocks)
    return _xhtml_chapter(heading, "\n".join(rendered)), heading


def _container_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opf:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>
"""


def _opf_package(
    book_id: str,
    title: str,
    author: str,
    language: str,
    manifest_items: list[dict],
    spine_ids: list[str],
    cover_id: Optional[str] = None,
) -> str:
    """Generate the OPF package file (the heart of the EPUB)."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    metadata_parts = [
        f'<dc:identifier id="bookid">{xml_escape(book_id)}</dc:identifier>',
        f"<dc:title>{xml_escape(title)}</dc:title>",
        f"<dc:language>{xml_escape(language)}</dc:language>",
        f'<meta property="dcterms:modified">{today}</meta>',
    ]
    if author:
        metadata_parts.insert(2, f"<dc:creator>{xml_escape(author)}</dc:creator>")
    if cover_id:
        metadata_parts.append(f'<meta name="cover" content="{xml_escape(cover_id)}"/>')

    manifest_parts = []
    for item in manifest_items:
        attrs = (
            f'id="{xml_escape(item["id"])}" '
            f'href="{xml_escape(item["href"])}" '
            f'media-type="{xml_escape(item["media_type"])}"'
        )
        if item.get("properties"):
            attrs += f' properties="{xml_escape(item["properties"])}"'
        manifest_parts.append(f"    <item {attrs}/>")

    spine_parts = [f'    <itemref idref="{xml_escape(sid)}"/>' for sid in spine_ids]

    return f"""<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="{language}">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    {chr(10).join('    ' + p for p in metadata_parts).strip()}
  </metadata>
  <manifest>
{chr(10).join(manifest_parts)}
  </manifest>
  <spine>
{chr(10).join(spine_parts)}
  </spine>
</package>
"""


def _nav_xhtml(toc_entries: list[dict], language: str = "en") -> str:
    """Generate the EPUB 3 navigation document (the table of contents)."""
    items = "\n".join(
        f'      <li><a href="{xml_escape(e["href"])}">{xml_escape(e["title"])}</a></li>'
        for e in toc_entries
    )
    return f"""<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="{language}" lang="{language}">
<head>
  <meta charset="utf-8"/>
  <title>Table of Contents</title>
  <link rel="stylesheet" type="text/css" href="stylesheet.css"/>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Contents</h1>
    <ol>
{items}
    </ol>
  </nav>
</body>
</html>
"""


def build_epub(
    project: dict,
    chapters: list[dict],
    author: str,
    include_title_page: bool = True,
    include_chapter_numbers: bool = True,
    cover_bytes: Optional[bytes] = None,
    cover_media_type: str = "image/jpeg",
) -> bytes:
    """
    Build an EPUB 3 from the project + chapters and return the raw bytes.

    `cover_bytes` is optional. If provided, it'll be included as the cover
    image; otherwise the EPUB ships without a cover (still valid).
    """
    title = project.get("title") or "Untitled"
    language = "en"
    book_id = f"urn:uuid:{uuid.uuid4()}"

    manifest_items: list[dict] = []
    spine_ids: list[str] = []
    toc_entries: list[dict] = []

    # The nav doc is required in EPUB 3.
    manifest_items.append(
        {"id": "nav", "href": "nav.xhtml", "media_type": "application/xhtml+xml", "properties": "nav"}
    )
    manifest_items.append(
        {"id": "css", "href": "stylesheet.css", "media_type": "text/css"}
    )

    # Cover image (if any) and cover page.
    cover_id = None
    if cover_bytes:
        ext = "jpg" if cover_media_type == "image/jpeg" else "png"
        cover_filename = f"cover.{ext}"
        cover_id = "cover-image"
        manifest_items.append(
            {
                "id": cover_id,
                "href": cover_filename,
                "media_type": cover_media_type,
                "properties": "cover-image",
            }
        )
        manifest_items.append(
            {"id": "cover", "href": "cover.xhtml", "media_type": "application/xhtml+xml"}
        )
        spine_ids.append("cover")

    # Title page.
    if include_title_page:
        manifest_items.append(
            {"id": "title-page", "href": "title.xhtml", "media_type": "application/xhtml+xml"}
        )
        spine_ids.append("title-page")
        toc_entries.append({"title": "Title", "href": "title.xhtml"})

    # Nav comes between title and chapters in the reading order.
    spine_ids.append("nav")

    # Chapters.
    chapter_files: list[tuple[str, str]] = []
    for idx, chapter in enumerate(chapters, start=1):
        chapter_id = f"ch{idx:04d}"
        chapter_href = f"chapter-{idx:04d}.xhtml"
        manifest_items.append(
            {"id": chapter_id, "href": chapter_href, "media_type": "application/xhtml+xml"}
        )
        spine_ids.append(chapter_id)
        body, heading = _xhtml_chapter_body(chapter, include_chapter_numbers)
        chapter_files.append((chapter_href, body))
        toc_entries.append({"title": heading, "href": chapter_href})

    # Build the OPF and nav now that we know everything.
    opf = _opf_package(
        book_id=book_id,
        title=title,
        author=author,
        language=language,
        manifest_items=manifest_items,
        spine_ids=spine_ids,
        cover_id=cover_id,
    )
    nav = _nav_xhtml(toc_entries, language=language)

    # Assemble the zip.
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        # The mimetype entry MUST be the first one and MUST be stored
        # (uncompressed) per the EPUB spec.
        zf.writestr(
            zipfile.ZipInfo("mimetype"),
            "application/epub+zip",
            compress_type=zipfile.ZIP_STORED,
        )
        zf.writestr("META-INF/container.xml", _container_xml())
        zf.writestr("OEBPS/content.opf", opf)
        zf.writestr("OEBPS/nav.xhtml", nav)
        zf.writestr("OEBPS/stylesheet.css", _EPUB_CSS)

        if include_title_page:
            zf.writestr("OEBPS/title.xhtml", _xhtml_title_page(project, author))

        if cover_bytes:
            ext = "jpg" if cover_media_type == "image/jpeg" else "png"
            zf.writestr(f"OEBPS/cover.{ext}", cover_bytes)
            zf.writestr("OEBPS/cover.xhtml", _xhtml_cover_page(f"cover.{ext}"))

        for href, body in chapter_files:
            zf.writestr(f"OEBPS/{href}", body)

    return buffer.getvalue()


# ── Filename helper ──────────────────────────────────────────────────────────


def safe_filename(title: str, extension: str) -> str:
    """Generate a download-safe filename from the project title."""
    safe = re.sub(r"[^\w\s-]", "", title or "manuscript").strip()
    safe = re.sub(r"\s+", "_", safe)[:50] or "manuscript"
    return f"{safe}.{extension}"
