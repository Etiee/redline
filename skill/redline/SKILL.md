---
name: redline
description: Review the user's writing and show every recommended change as an interactive track-changes card inline in the chat. Use only when the user says "redline" or invokes /redline.
---

# Redline

The card displays your recommendations. It does not rewrite the piece. The writer applies each change themselves, so every change must be visible, findable, and justified.

## What to look for

- Errors: spelling, grammar, punctuation.
- Factual errors: wrong dates, names, figures, claims.
- Unclear writing: ambiguous, tangled, or misleading sentences.
- Citations: wrong author, year, or source, or a source that doesn't support the claim.
- Gaps: places where the writing doesn't answer the question or prompt (when the user gave one).

Keep the writer's voice and style. Make the smallest edit that fixes a real problem, and leave sentences that work alone. Don't polish for the sake of it. Never invent a source; if you can't verify a citation, add a note.

## Output

1. Call the inline widget tool (`show_widget`; `mcp__visualize__show_widget` in Claude Code). If it requires a `read_me` call first, make that call once with `modules: ["interactive"]`. Use `title: "redline_review"`, `loading_messages: ["Marking up your text"]`, and this `widget_code`, with nothing else added:

```html
<script type="text/redline">MARKED TEXT</script>
<script src="https://cdn.jsdelivr.net/gh/Etiee/redline@1/redline.min.js" onerror="var s=document.querySelector('script[type$=redline]'),p=document.createElement('pre');p.style.whiteSpace='pre-wrap';p.textContent=s.textContent;s.after(p)"></script>
```

2. After the widget, write at most two short sentences: the most important issue, plus anything you couldn't verify. Don't list the changes again.

If no widget tool is available, put the marked text in a `text` code block and say the card needs inline visuals turned on.

## Marked text

Write the user's whole text once, exactly as given, paragraph breaks included, with marks inline:

| Edit | Syntax |
|---|---|
| Replace | `{~~old~>new~~}` |
| Add | `{++new++}` |
| Remove | `{--old--}` |
| Move | `{mv1--moved text--}` where it was, `{mv1++}` where it goes (same number per move) |
| Note on a span, no edit | `{==span==}{>>reason<<}` |
| Note at a point | `{>>reason<<}` on its own |

Put a reason straight after every mark, with no space between: `{>>tag: reason<<}`. Tags: `error`, `spelling`, `grammar`, `fact`, `clarity`, `cite`, `gap`, `style`, `flow`. A reason is 15 words or fewer, plain, and says why. The mark already shows what changed. Don't write "consider", "enhance", "ensure", or "it's important to".

Rules:
- Text outside marks must match the original character for character. Never fix anything silently.
- Mark the smallest span: the word, not the sentence. Give each separate issue its own mark.
- Put spaces inside additions and removals so the result reads right: `the {--very --}big`, `word{++ and more++}`.
- Punctuation gets its own mark: `that{--,--} each`, `{~~,~>;~~}`. The card colours it separately.
- For a rewrite of more than about eight words, replace the whole clause in one `{~~old~>new~~}`.
- Gaps: draft the missing text in the writer's voice as `{++…++}{>>gap: …<<}`. If only the writer can supply it (a source, data, a personal detail), use a note.
- Write `</script` as `<\/script`.
- If nothing needs changing, render the text with no marks and say so.

Example:

```
The treaty was signed in {~~1658~>1648~~}{>>fact: It was signed in 1648.<<} and ended the Thirty Years{++’++}{>>grammar: Possessive apostrophe in the war's name.<<} War. It {--clearly --}{>>clarity: Stronger than your evidence.<<}changed {~~there~>their~~}{>>spelling: Possessive, not a place.<<} borders {==(Krasner, 1999)==}{>>cite: Krasner argues the opposite. Check this source.<<}.
```
