# Fixtures

Sample documents used for manual and automated formatting checks. Nothing here ships with the app.

## `long-article.md`

A ~4,500-word Vietnamese article that exercises most of the editor: H1/H2/H3, short and very long paragraphs, bullet / numbered / to-do lists (nested and flat), block quotes, fenced code blocks, four tables, bold / italic / strikethrough / inline code, links, a long URL and a long identifier with no spaces.

**How to use it**

1. Open Folio and create a page.
2. Click into the editor.
3. Paste the file contents (⌘V). BlockNote detects pasted plain text as Markdown, so it arrives as real blocks rather than one paragraph.

`pbcopy < docs/fixtures/long-article.md` puts it on the clipboard.

**What paste does not cover**

Paste goes through the Markdown parser, so anything without a Markdown equivalent stays out: images, side-by-side columns, underline, colors and highlights. Add those manually after pasting if the check needs them. Checklist items, tables and code blocks do survive.

**Expected result (verified on WebKit)**

1 × H1, 15 × H2, 14 × H3, 49 paragraphs, 26 bullet items (7 nested), 19 numbered items, 13 to-do items (2 checked), 5 quotes, 5 code blocks, 4 tables with header rows, 20 bold runs, 7 italic runs, 1 strikethrough, 10 inline-code runs, 4 links, no horizontal page overflow.

The page title stays "Không có tiêu đề" after pasting, because the title is separate from the first heading. Rename the page if you want the breadcrumb to match the article.
