# redline

A track-changes card for writing reviews, drawn inline in Claude chat (claude.ai and Claude Code).

Claude writes your text once with the changes marked inline (CriticMarkup plus a move syntax). This script turns that into an interactive card:

- **Tracked**: the whole text, with every change highlighted in place
- **Redline**: Word-style strikethrough and underline, with change bars
- **Changes**: one row per change, with a few words of context so you can find it
- **Original** and **Final**: clean text, no markup

Hover or tap any change to see why it's suggested.

## Use

```html
<script type="text/redline">Signed in {~~1658~>1648~~}{>>fact: It was 1648.<<}.</script>
<script src="https://cdn.jsdelivr.net/gh/Etiee/redline@1/redline.min.js"></script>
```

The Claude skill is in [`skill/redline/SKILL.md`](skill/redline/SKILL.md). Open `demo.html` to see every edit type.

Your text never leaves the page. The script only reads the marked text already in the widget.

MIT licensed.
