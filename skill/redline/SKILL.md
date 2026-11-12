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

**Step 1: check for the card tool before writing anything.** Look through the tools you actually have for one named `show_widget` or ending in `show_widget` (for example `visualize:show_widget` or `mcp__visualize__show_widget`). Don't assume it's there. If it isn't in your tool list, go to "No card tool" below.

**Step 2: draw the card.** Your first output must be the tool call itself, not a written review. If the tool asks for a `read_me` call first, make it once with `modules: ["interactive"]`. Then call `show_widget` with `title: "redline_review"`, `loading_messages: ["Marking up your text"]`, and this `widget_code`, adding nothing else:

```html
<div id="redline" style="min-height:120px"></div>
<script src="https://cdn.jsdelivr.net/gh/Etiee/redline@1/redline.min.js"></script>
<script>var t=String.raw`MARKED TEXT`;window.Redline?Redline.render('#redline',t):document.getElementById('redline').innerText=t</script>
```

Keep these three parts in this order. Don't use any other kind of `<script>` tag, and put the marked text only inside the backticks.

**Step 3: after the call returns,** write at most two short sentences: the most important issue, plus anything you couldn't verify. Don't list the changes again. Never say the card is shown unless the tool call actually ran and returned without an error.

### No card tool

Don't print the marked text or any `{++ ++}` markup. Start with this line: "Inline visuals aren't on in this chat, so here's the list version." Then give a numbered list in document order, one item per change:

```
1. **Changed · Fact**: …of Westphalia, signed in ~~1658~~ **1648**, is often seen…
   It was signed in 1648.
2. **Added · Gap**: …new forms of sovereignty. **This matters because later writers…**
   The question asks how it shaped the system.
3. **Moved · Flow**: "Many scholars, however, argue…" from after "…own state's religion." to after "…new forms of sovereignty."
   Reads better as a turn after your main claims.
4. **Note · Citation**: …international politics (Krasner, 1999).
   Krasner argues the opposite. Check this source.
```

In each item, quote up to four words of the original on each side so the writer can search for the spot. Show removed text as `~~old~~` and new text as `**new**`. For punctuation, name the mark in words too (for example "remove the comma after *that*"). End with the same two sentences as Step 3.

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
- Inside the backticks, write a backtick as `` \` ``, `${` as `\${`, and `</script` as `<\/script`. Leave everything else as is.
- If nothing needs changing, render the text with no marks and say so.

Example:

```
The treaty was signed in {~~1658~>1648~~}{>>fact: It was signed in 1648.<<} and ended the Thirty Years{++’++}{>>grammar: Possessive apostrophe in the war's name.<<} War. It {--clearly --}{>>clarity: Stronger than your evidence.<<}changed {~~there~>their~~}{>>spelling: Possessive, not a place.<<} borders {==(Krasner, 1999)==}{>>cite: Krasner argues the opposite. Check this source.<<}.
```
