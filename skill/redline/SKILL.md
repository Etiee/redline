---
name: redline
description: Show recommended changes to the user's writing as an interactive track-changes card inline in the chat. Use only when the user says "redline" or invokes /redline.
---

# Redline

The card shows changes; it doesn't decide them. The user says what to change and how (for example "fix grammar only", "make it more formal", "cut to 200 words"). Make exactly those changes and nothing else. If they gave no instructions, mark only clear errors (spelling, grammar, punctuation, wrong facts) and rewrite nothing.

Every change must be visible and carry a short reason. Never invent a source or fact; if something can't be verified, add a note instead of an edit.

## Output

1. Check your tools for one named `show_widget` or ending in `show_widget`. If there is none, use "No card tool" below.
2. Your first output is the tool call, not a written review. If the tool needs `read_me` first, call it once with `modules: ["interactive"]`. Then call `show_widget` with `title: "redline_review"`, `loading_messages: ["Marking up your text"]`, and exactly this `widget_code`:

```html
<div id="redline" style="min-height:120px"></div>
<script src="https://cdn.jsdelivr.net/gh/Etiee/redline@1/redline.min.js"></script>
<script>var t=String.raw`MARKED TEXT`;window.Redline?Redline.render('#redline',t):document.getElementById('redline').innerText=t</script>
```

3. After the call returns, write at most one short sentence (only if something couldn't be verified or needs the user's input). Don't list the changes again. Never say the card is shown unless the call succeeded.

### No card tool

Don't print `{++ ++}` markup. Say "Inline visuals aren't on in this chat, so here's the list version." Then a numbered list in document order, one line per change, with up to four words of context each side so the user can search for it, `~~old~~` for removed and `**new**` for added text, then the reason:

```
1. Fact: …of Westphalia, signed in ~~1658~~ **1648**, is often… (It was 1648.)
```

## Marked text

Write the user's whole text once, exactly as given (paragraph breaks included), with marks inline:

| Edit | Syntax |
|---|---|
| Replace | `{~~old~>new~~}` |
| Add | `{++new++}` |
| Remove | `{--old--}` |
| Move | `{mv1--text--}` where it was, `{mv1++}` where it goes |
| Comment on a span | `{==span==}{>>reason<<}` |
| Comment at a point | `{>>reason<<}` |

Follow every mark directly with `{>>tag: reason<<}` (no space). Tags: `error`, `spelling`, `grammar`, `fact`, `clarity`, `cite`, `gap`, `style`, `flow`. Reasons: 12 words or fewer, say why.

- Text outside marks must match the original exactly. No silent fixes.
- Mark only the words that change, never the sentence around them. To fix one word, the mark holds that word: `I {~~goes~>went~~}{>>grammar: Past tense.<<} to the store`, not `{~~I goes to the store~>I went to the store~~}`. Several small fixes in one sentence are several marks. Replace a whole sentence only when the user asked for it to be rewritten.
- One issue per mark. Punctuation gets its own mark.
- Keep spacing inside marks so the result reads right: `the {--very --}big`.
- Inside the backticks escape `` ` `` as `` \` ``, `${` as `\${`, `</script` as `<\/script`.
- If nothing needs changing, render the text unmarked and say so.

Example: `signed in {~~1658~>1648~~}{>>fact: It was 1648.<<} the {--very --}{>>style: Filler.<<}first`
