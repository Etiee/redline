# redline

A track-changes card for writing reviews, drawn inline in Claude chat (claude.ai and Claude Code).

You tell Claude what to change (or just "redline" for error fixes only). Claude writes your text once with the changes marked inline (CriticMarkup plus a move syntax), and this script turns that into an interactive card:

- **Tracked**: the whole text, Word-style strikethrough and underline in place
- **Side by side**: before and after next to each other, paragraph by paragraph
- **Changes**: one row per change, with a few words of context so you can find it
- **Final**: clean text with a copy button

Colours follow what happens to the text: green is new, red is removed, blue is moved, amber is a comment.

Hover or tap any change to see why. Tick changes as you apply them in your own document to track progress.

## Use

```html
<div id="redline"></div>
<script src="https://cdn.jsdelivr.net/gh/Etiee/redline@1/redline.min.js"></script>
<script>Redline.render('#redline', String.raw`Signed in {~~1658~>1648~~}{>>fact: It was 1648.<<}.`)</script>
```

The Claude skill is in [`skill/redline/SKILL.md`](skill/redline/SKILL.md). Open `demo.html` to see every edit type.

Your text never leaves the page. The script only reads the marked text already in the widget.

MIT licensed.
