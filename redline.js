/*! redline v1.2.0 | track-changes card for Claude chat | MIT */
(function () {
  'use strict';
  if (window.Redline && window.Redline.version) { window.Redline.auto(); return; }

  var VERSION = '1.2.0';
  var ORDER = ['sub', 'add', 'del', 'punct', 'move', 'note'];
  var KIND = { sub: 'Changed', add: 'Added', del: 'Removed', punct: 'Punctuation', move: 'Moved', note: 'Note' };
  var TAGS = {
    error: 'Error', typo: 'Spelling', spelling: 'Spelling', grammar: 'Grammar', fact: 'Fact',
    clarity: 'Clarity', clear: 'Clarity', cite: 'Citation', citation: 'Citation', gap: 'Gap',
    style: 'Style', flow: 'Flow', wording: 'Wording', tone: 'Tone', structure: 'Structure'
  };
  var RE = /\{\+\+([\s\S]*?)\+\+\}|\{--([\s\S]*?)--\}|\{~~([\s\S]*?)~>([\s\S]*?)~~\}|\{==([\s\S]*?)==\}|\{>>([\s\S]*?)<<\}|\{mv(\d+)--([\s\S]*?)--\}|\{mv(\d+)\+\+\}/g;

  function svg(p, s) {
    return '<svg class="rl-i" width="' + (s || 12) + '" height="' + (s || 12) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }
  var I_MOVE = svg('<path d="M6 6v6a3 3 0 0 0 3 3h10"/><path d="M15 11l4 4l-4 4"/>', 11);
  var I_NOTE = svg('<path d="M8 9h8"/><path d="M8 13h6"/><path d="M18 4a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-5l-5 3v-3h-2a3 3 0 0 1 -3 -3v-8a3 3 0 0 1 3 -3z"/>', 13);
  var I_PREV = svg('<path d="M15 6l-6 6l6 6"/>', 14);
  var I_NEXT = svg('<path d="M9 6l6 6l-6 6"/>', 14);
  var I_COPY = svg('<path d="M9 7h9a2 2 0 0 1 2 2v9a2 2 0 0 1 -2 2h-9a2 2 0 0 1 -2 -2v-9a2 2 0 0 1 2 -2z"/><path d="M4 16v-10a2 2 0 0 1 2 -2h10"/>', 14);
  var I_CHECK = svg('<path d="M5 12l5 5l10 -10"/>', 14);
  var I_TICK = svg('<path d="M5 12l5 5l10 -10"/>', 12);

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function br(s) { return esc(s).replace(/\n/g, '<br>'); }
  function bare(s) { return String(s).replace(/[\p{P}\s]/gu, ''); }
  function trunc(s, n) { s = String(s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

  function reasonOf(r) {
    r = r.trim();
    var m = /^([a-z]+)\s*:\s*/i.exec(r);
    if (m && TAGS[m[1].toLowerCase()]) return { tag: TAGS[m[1].toLowerCase()], text: r.slice(m[0].length).trim() };
    return { tag: '', text: r };
  }

  /* ---------- minimal replacement ---------- */
  function toks(s) { return String(s).match(/\s+|[^\s\p{P}]+|\p{P}/gu) || []; }
  function words(s) { return toks(s).filter(function (t) { return bare(t); }).length; }
  function wdiff(a, b) {
    var A = toks(a), B = toks(b), n = A.length, k = B.length, i, j;
    if (n * k > 250000) return null;
    var L = [];
    for (i = 0; i <= n; i++) L.push(new Int32Array(k + 1));
    for (i = n - 1; i >= 0; i--) for (j = k - 1; j >= 0; j--)
      L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    var ops = [];
    function add(t, s) { var p = ops[ops.length - 1]; if (p && p.t === t) p.s += s; else ops.push({ t: t, s: s }); }
    i = 0; j = 0;
    while (i < n || j < k) {
      if (i < n && j < k && A[i] === B[j]) { add('=', A[i]); i++; j++; }
      else if (j < k && (i === n || L[i][j + 1] >= L[i + 1][j])) { add('+', B[j]); j++; }
      else { add('-', A[i]); i++; }
    }
    return ops;
  }
  /* Returns pieces [{x: text} | {o: old, n: new}]. Shared words at the edges become plain text.
     If most words are shared (a light edit dressed up as a rewrite), every changed run gets its own mark. */
  function minimal(o, n) {
    var ops = wdiff(o, n);
    if (!ops) return null;
    var f = -1, l = -1, same = 0, k;
    ops.forEach(function (p, idx) { if (p.t !== '=') { if (f < 0) f = idx; l = idx; } else same += words(p.s); });
    if (f < 0) return [{ x: o }];
    var total = words(o), fine = total >= 4 && same / total >= 0.5;
    var out = [], cur = null;
    function flush() { if (cur) { out.push(cur); cur = null; } }
    for (k = 0; k < f; k++) out.push({ x: ops[k].s });
    for (k = f; k <= l; k++) {
      var p = ops[k];
      if (p.t === '=' && fine && bare(p.s)) { flush(); out.push({ x: p.s }); continue; }
      cur = cur || { o: '', n: '' };
      if (p.t !== '+') cur.o += p.s;
      if (p.t !== '-') cur.n += p.s;
    }
    flush();
    for (k = l + 1; k < ops.length; k++) out.push({ x: ops[k].s });
    return out;
  }

  /* ---------- parse ---------- */
  function parse(src) {
    src = String(src || '').replace(/<\\\//g, '</').replace(/\\`/g, '`').replace(/\\\$\{/g, '${').replace(/\r\n?/g, '\n').replace(/^[ \t]*\n+|\n+[ \t]*$/g, '');
    var segs = [], changes = [], moves = {}, pos = 0, m;
    function push(c, op) {
      if (c.i == null) { c.i = changes.length; changes.push(c); }
      segs.push({ t: 'm', i: c.i, op: op });
    }
    function one(o, n) {
      return !n ? { op: 'del', kind: 'del', old: o } : !o ? { op: 'add', kind: 'add', nw: n } : { op: 'sub', kind: 'sub', old: o, nw: n };
    }
    var last = null;
    RE.lastIndex = 0;
    while ((m = RE.exec(src))) {
      var adj = m.index === pos ? last : null;
      last = null;
      if (m.index > pos) segs.push({ t: 'x', s: src.slice(pos, m.index) });
      pos = RE.lastIndex;
      if (m[6] !== undefined) {
        var r = reasonOf(m[6]);
        if (adj) {
          adj.forEach(function (c0) { c0.reason = c0.reason ? c0.reason + ' ' + r.text : r.text; c0.tag = c0.tag || r.tag; });
          last = adj;
        } else push({ op: 'pt', kind: 'note', reason: r.text, tag: r.tag }, 'pt');
        continue;
      }
      var c;
      if (m[1] !== undefined) push(c = { op: 'add', kind: 'add', nw: m[1] }, 'add');
      else if (m[2] !== undefined) push(c = { op: 'del', kind: 'del', old: m[2] }, 'del');
      else if (m[3] !== undefined) {
        /* trim a replacement to the words that actually differ */
        last = [];
        (minimal(m[3], m[4]) || [{ o: m[3], n: m[4] }]).forEach(function (p) {
          if (p.x != null) { if (p.x) segs.push({ t: 'x', s: p.x }); return; }
          var cc = one(p.o, p.n); push(cc, cc.op); last.push(cc);
        });
        if (!last.length) last = null;
        continue;
      } else if (m[5] !== undefined) push(c = { op: 'hl', kind: 'note', s: m[5] }, 'hl');
      else if (m[7] !== undefined) {
        c = moves[m[7]] || (moves[m[7]] = { op: 'move', kind: 'move', text: '' });
        c.text = m[8]; c.from = true; push(c, 'from');
      } else if (m[9] !== undefined) {
        c = moves[m[9]] || (moves[m[9]] = { op: 'move', kind: 'move', text: '' });
        c.to = true; push(c, 'to');
      }
      last = c ? [c] : null;
    }
    if (pos < src.length) segs.push({ t: 'x', s: src.slice(pos) });

    var nMove = 0, nNote = 0;
    changes.forEach(function (c) {
      if (c.op === 'add' && c.nw && !bare(c.nw)) c.kind = 'punct';
      if (c.op === 'del' && c.old && !bare(c.old)) c.kind = 'punct';
      if (c.op === 'sub' && c.old !== c.nw && bare(c.old) === bare(c.nw)) c.kind = 'punct';
      if (c.kind === 'move') c.n = ++nMove;
      if (c.kind === 'note') c.n = ++nNote;
      c.reason = c.reason || '';
      c.tag = c.tag || '';
    });

    var orig = '', fin = '';
    segs.forEach(function (s) {
      s.o = orig.length;
      if (s.t === 'x') { orig += s.s; fin += s.s; return; }
      var c = changes[s.i];
      if (s.op === 'del' || s.op === 'sub') orig += c.old;
      if (s.op === 'add' || s.op === 'sub') fin += c.nw;
      if (s.op === 'hl') { orig += c.s; fin += c.s; }
      if (s.op === 'from') orig += c.text;
      if (s.op === 'to') fin += c.text;
      s.e = orig.length;
      if (s.op === 'to') { c.oTo = s.o; } else if (c.o == null) { c.o = s.o; c.e = s.e; }
    });
    fin = fin.replace(/([^\s]) {2,}(?=\S)/g, '$1 ').replace(/[ \t]+\n/g, '\n');
    return { segs: segs, changes: changes, original: orig, final: fin };
  }

  /* ---------- html ---------- */
  function attrs(c) {
    return ' data-i="' + c.i + '" tabindex="0" aria-label="' + esc(ariaOf(c)) + '"';
  }
  function ariaOf(c) {
    var d = c.op === 'add' ? 'add "' + trunc(c.nw, 60) + '"'
      : c.op === 'del' ? 'remove "' + trunc(c.old, 60) + '"'
      : c.op === 'sub' ? '"' + trunc(c.old, 40) + '" to "' + trunc(c.nw, 40) + '"'
      : c.op === 'move' ? '"' + trunc(c.text, 60) + '"'
      : c.op === 'hl' ? '"' + trunc(c.s, 60) + '"' : '';
    return KIND[c.kind] + (d ? ': ' + d : '') + (c.reason ? '. ' + c.reason : '');
  }
  var HIDE = { before: { add: 1, to: 1 }, after: { del: 1, from: 1, pt: 1 } };
  function mark(c, op, inert, side) {
    if (side && HIDE[side][op]) return '';
    if (side && op === 'sub') op = side === 'before' ? 'del' : 'add';
    var a = inert ? ' data-i="' + c.i + '"' : attrs(c);
    var k = '<span class="rl-m k-' + c.kind + ' o-' + op + '"' + a + '>';
    var badge = '<span class="rl-badge">' + I_MOVE + c.n + '</span>';
    switch (op) {
      case 'add': return k + '<ins>' + br(c.nw) + '</ins></span>';
      case 'del': return k + '<del>' + br(c.old) + '</del></span>';
      case 'sub': return k + '<del>' + br(c.old) + '</del><ins>' + br(c.nw) + '</ins></span>';
      case 'hl': return k + '<span class="rl-hl">' + br(c.s) + '</span></span>';
      case 'pt': return k + '<span class="rl-pt">' + I_NOTE + '</span></span>';
      case 'from': return k + badge + '<del>' + br(c.text) + '</del></span>';
      case 'to': return k + badge + '<ins>' + br(c.text) + '</ins></span>';
    }
    return '';
  }

  function paras(d, interactive, side) {
    var paras = [{ h: '' }];
    d.segs.forEach(function (s) {
      if (s.t === 'x') {
        s.s.split(/\n{2,}/).forEach(function (p, k) {
          if (k) paras.push({ h: '' });
          paras[paras.length - 1].h += br(p);
        });
      } else {
        paras[paras.length - 1].h += mark(d.changes[s.i], s.op, !interactive, side);
      }
    });
    return paras.map(function (p) { return p.h; });
  }

  function docHTML(d) {
    return paras(d, true).map(function (h) { return '<p class="rl-p">' + (h || '<br>') + '</p>'; }).join('');
  }

  function sideHTML(d) {
    var A = paras(d, true, 'before'), B = paras(d, true, 'after');
    var h = '<div class="rl-cmp"><div class="rl-ch">Before</div><div class="rl-ch">After</div>';
    A.forEach(function (a, k) {
      h += '<p class="rl-cc rl-before" data-l="Before">' + (a || '<br>') + '</p><p class="rl-cc rl-after" data-l="After">' + (B[k] || '<br>') + '</p>';
    });
    return h + '</div>';
  }

  function cleanHTML(text) {
    return text.split(/\n{2,}/).map(function (p) { return '<p class="rl-p">' + (br(p) || '<br>') + '</p>'; }).join('');
  }

  function ctx(orig, a, b, mid) {
    var before = orig.slice(Math.max(0, a - 90), a).split('\n').pop();
    var after = orig.slice(b, b + 90).split('\n')[0];
    var bm = /(?:\S+\s*){0,4}$/.exec(before)[0];
    var am = /^(?:\s*\S+){0,4}/.exec(after)[0];
    var lead = bm.length < before.length ? '…' : '';
    var tail = am.length < after.length && !/[.!?]["”’)]?$/.test(am) ? '…' : '';
    return '<span class="rl-cx">' + lead + esc(bm) + '</span>' + mid + '<span class="rl-cx">' + esc(am) + tail + '</span>';
  }

  function listHTML(d) {
    if (!d.changes.length) return '<p class="rl-empty">No changes suggested.</p>';
    return '<ol class="rl-list">' + d.changes.map(function (c) {
      var head = '<span class="rl-chip k-' + c.kind + '">' + KIND[c.kind] + '</span>' +
        (c.tag ? '<span class="rl-tag">' + esc(c.tag) + '</span>' : '');
      var body;
      if (c.op === 'move') {
        var from = c.o != null ? ctx(d.original, c.o, c.e, mark(c, 'from', true)) : '';
        var to = c.oTo != null ? ctx(d.original, c.oTo, c.oTo, mark(c, 'to', true)) : '';
        body = (from ? '<span class="rl-ln"><span class="rl-lab">From</span><span>' + from + '</span></span>' : '') +
          (to ? '<span class="rl-ln"><span class="rl-lab">To</span><span>' + to + '</span></span>' : '');
      } else {
        var op = c.op;
        body = '<span class="rl-ln"><span>' + ctx(d.original, c.o, c.e, mark(c, op, true)) + '</span></span>';
      }
      return '<li data-i="' + c.i + '"><button type="button" class="rl-row" data-go="' + c.i + '">' +
        '<span class="rl-num">' + (c.i + 1) + '</span>' +
        '<span class="rl-rb"><span class="rl-rh">' + head + '</span>' +
        '<span class="rl-ctx">' + body + '</span>' +
        (c.reason ? '<span class="rl-why">' + esc(c.reason) + '</span>' : '') +
        '</span></button>' + doneBtn(c.i) + '</li>';
    }).join('') + '</ol>';
  }

  function doneBtn(i) {
    return '<button type="button" class="rl-done" data-done="' + i + '" aria-pressed="false" aria-label="Mark change ' + (i + 1) + ' as applied">' + I_TICK + '</button>';
  }

  var SAMPLE = {
    sub: { op: 'sub', kind: 'sub', old: 'a', nw: 'b' },
    add: { op: 'add', kind: 'add', nw: 'ab' },
    del: { op: 'del', kind: 'del', old: 'ab' },
    punct: { op: 'add', kind: 'punct', nw: ';' },
    move: { op: 'move', kind: 'move', text: 'ab', n: '' },
    note: { op: 'hl', kind: 'note', s: 'ab', n: '' }
  };

  /* ---------- css ---------- */
  var CSS = [
    '.rl{--rl-fg:var(--text-primary,#1f1e1d);--rl-fg2:var(--text-secondary,#5e5d59);--rl-fg3:var(--text-muted,#87867f);--rl-bd:var(--border,rgba(31,30,29,.14));--rl-bd2:var(--border-strong,rgba(31,30,29,.24));--rl-s1:var(--surface-1,#f5f4ef);--rl-s2:var(--surface-2,#fff);--rl-r:var(--radius,8px);',
    '--h-add:#1F8F5F;--h-del:#D0453B;--h-mov:#2F6FD0;--h-note:#C7881A;',
    '--c-add:color-mix(in srgb,var(--h-add) 72%,var(--rl-fg));--c-del:color-mix(in srgb,var(--h-del) 72%,var(--rl-fg));--c-mov:color-mix(in srgb,var(--h-mov) 72%,var(--rl-fg));--c-note:color-mix(in srgb,var(--h-note) 72%,var(--rl-fg));',
    '--b-add:color-mix(in srgb,var(--h-add) 13%,transparent);--b-del:color-mix(in srgb,var(--h-del) 12%,transparent);--b-mov:color-mix(in srgb,var(--h-mov) 13%,transparent);--b-note:color-mix(in srgb,var(--h-note) 18%,transparent);',
    'position:relative;display:block;color:var(--rl-fg);font-family:var(--font-sans,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif);background:var(--rl-s2);border:.5px solid var(--rl-bd2);border-radius:12px;margin:4px 0;-webkit-tap-highlight-color:transparent;text-align:left}',
    '.rl *,.rl *::before,.rl *::after{box-sizing:border-box}',
    '.rl ::selection{background:color-mix(in srgb,var(--h-note) 30%,transparent)}',
    '.rl-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;margin:-1px;padding:0;border:0}',
    '.rl button{font:inherit!important;color:inherit!important;background:none!important;border:0!important;margin:0!important;box-shadow:none!important;cursor:pointer!important;height:auto!important;min-width:0!important;-webkit-user-select:none!important;user-select:none!important;touch-action:manipulation!important;transform:none!important}',
    '.rl button:focus-visible{outline:2px solid color-mix(in srgb,var(--h-note) 70%,transparent)!important;outline-offset:2px!important}',
    /* bar */
    '.rl-bar{display:flex;align-items:stretch;gap:4px;padding:0 12px 0 8px;border-bottom:.5px solid var(--rl-bd)}',
    '.rl-seg{display:flex;gap:2px;min-width:0}',
    '.rl-seg button{position:relative!important;font-size:13px!important;line-height:1!important;padding:15px 10px 14px!important;min-height:44px!important;white-space:nowrap!important;color:var(--rl-fg3)!important;transition:color .15s!important}',
    '.rl-seg button[aria-pressed=true]{color:var(--rl-fg)!important}.rl-seg button[aria-pressed=true]::after{content:"";position:absolute;left:10px;right:10px;bottom:-.5px;height:1.5px;border-radius:1px;background:var(--rl-fg)}',
    '.rl-n{margin-left:5px;color:var(--rl-fg3);font-variant-numeric:tabular-nums}',
    '.rl .rl-copy{margin:auto 0 auto auto!important;display:inline-flex!important;align-items:center!important;gap:6px!important;font-size:13px!important;padding:6px 10px!important;min-height:30px!important;border-radius:var(--rl-r)!important;color:var(--rl-fg2)!important;box-shadow:inset 0 0 0 .5px var(--rl-bd2)!important}',
    '.rl-copy[hidden]{display:none!important}',
    '@media (hover:hover){.rl-seg button:hover,.rl-copy:hover{color:var(--rl-fg)!important}.rl-copy:hover,.rl-row:hover,.rl-pop button:hover{background:var(--rl-s1)!important}.rl-done:hover{box-shadow:inset 0 0 0 1px var(--rl-fg3)!important}}',
    /* body */
    '.rl-body{padding:20px 24px 22px;font-size:16px;line-height:1.75;overflow-wrap:break-word}',
    '.rl-p{margin:0 0 .9em}.rl-p:last-child{margin-bottom:0}',
    '.rl-empty{margin:0;padding:16px 22px;color:var(--rl-fg2);font-size:14px}',
    '.rl ins,.rl del{text-decoration:none;color:inherit;background:none}',
    '.rl-m{border-radius:3px;cursor:pointer;outline:none;-webkit-box-decoration-break:clone;box-decoration-break:clone;transition:background-color .15s,opacity .15s}',
    '.rl-badge{display:inline-flex;align-items:center;gap:1px;font-size:11px;line-height:1;font-weight:500;font-variant-numeric:tabular-nums;color:var(--c-mov);vertical-align:.14em;margin-right:2px}',
    '.rl-pt{display:inline-flex;vertical-align:-.1em;color:var(--c-note);margin:0 2px}',
    /* tracked: colour + decoration, no fills (punctuation keeps a faint pill so a comma is findable) */
    '.rl-t .k-add ins,.rl-t .k-sub ins{color:var(--c-add);text-decoration:underline 1.5px;text-underline-offset:.2em}',
    '.rl-t .k-del del,.rl-t .k-sub del{color:var(--c-del);text-decoration:line-through 1.5px}',
    '.rl-t .k-sub del+ins{margin-left:.25em}',
    '.rl-t .k-punct ins,.rl-t .k-punct del{font-weight:600;padding:0 .2em;margin:0 1px;border-radius:3px}.rl-t .k-punct ins{color:var(--c-add);background:var(--b-add)}.rl-t .k-punct del{color:var(--c-del);background:var(--b-del)}',
    '.rl-t .k-punct ins{text-decoration:underline 1.5px;text-underline-offset:.2em}.rl-t .k-punct del{text-decoration:line-through 1.5px}',
    '.rl-t .k-move ins,.rl-t .k-move del{color:var(--c-mov)}',
    '.rl-t .k-move del{text-decoration:line-through double 1px}.rl-t .k-move ins{text-decoration:underline double 1px;text-underline-offset:.2em}',
    '.rl-t .k-note .rl-hl{text-decoration:underline dotted 1.5px;text-decoration-color:var(--c-note);text-underline-offset:.26em}',
    /* hover / focus / applied */
    '.k-add{--tint:var(--b-add)}.k-del{--tint:var(--b-del)}.k-move{--tint:var(--b-mov)}.k-note{--tint:var(--b-note)}.k-sub,.k-punct{--tint:color-mix(in srgb,var(--rl-fg) 7%,transparent)}',
    '.rl-m.is-hot,.rl-m:focus-visible{background:var(--tint)}',
    '.rl-m:focus-visible{box-shadow:0 0 0 1.5px var(--rl-fg3)}',
    '.rl-t:not(.is-list) .rl-m.is-done{opacity:.38}',
    /* list */
    '.rl-body.is-list{padding:4px 0}',
    '.rl-list{list-style:none;margin:0;padding:0}',
    '.rl-list li{display:flex;align-items:flex-start;padding-right:14px}',
    '.rl-list li+li{border-top:.5px solid var(--rl-bd)}',
    '.rl-row{flex:1;display:grid!important;grid-template-columns:22px minmax(0,1fr)!important;gap:10px!important;min-width:0!important;text-align:left!important;padding:13px 10px 14px 14px!important;border-radius:0!important;transition:background-color .15s!important}',
    '.rl-num{font-size:13px;line-height:22px;color:var(--rl-fg3);font-variant-numeric:tabular-nums;text-align:right}',
    '.rl-rb{display:flex;flex-direction:column;gap:4px;min-width:0;transition:opacity .15s}',
    '.rl-rh{display:flex;align-items:center;gap:6px;font-size:13px;line-height:22px;color:var(--rl-fg3)}',
    '.rl-ctx{display:flex;flex-direction:column;gap:3px;font-size:15px;line-height:1.6;color:var(--rl-fg)}',
    '.rl-ln{display:flex;gap:8px;align-items:baseline}',
    '.rl-lab{flex:none;width:34px;font-size:12px;color:var(--rl-fg3)}',
    '.rl-cx{color:var(--rl-fg2)}',
    '.rl-why{font-size:13px;line-height:1.5;color:var(--rl-fg2)}',
    '.rl-list li.is-done .rl-rb{opacity:.42}',
    '.rl .rl-done{flex:none;display:inline-flex!important;align-items:center!important;justify-content:center!important;width:24px!important;height:24px!important;margin:12px 0 0!important;border-radius:50%!important;box-shadow:inset 0 0 0 1px var(--rl-bd2)!important;color:transparent!important;transition:background-color .15s,color .15s!important}',
    '.rl .rl-done[aria-pressed=true]{background:var(--rl-fg)!important;color:var(--rl-s2)!important;box-shadow:none!important}',
    /* kind label: coloured square + text, no filled chip */
    '.rl-chip{display:inline-flex;align-items:center;gap:6px;font-size:13px;font-weight:500;color:var(--rl-fg)}',
    '.rl-chip::before{content:"";width:7px;height:7px;border-radius:2px;background:var(--c,var(--rl-fg3))}',
    '.rl-chip.k-add{--c:var(--c-add)}.rl-chip.k-del{--c:var(--c-del)}.rl-chip.k-move{--c:var(--c-mov)}.rl-chip.k-note{--c:var(--c-note)}.rl-chip.k-sub::before,.rl-chip.k-punct::before{background:linear-gradient(90deg,var(--c-del) 50%,var(--c-add) 50%)}',
    '.rl-tag{font-size:13px;color:var(--rl-fg3)}.rl-tag::before{content:"·";margin-right:6px}',
    /* footer */
    '.rl-foot{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;padding:10px 16px 11px;border-top:.5px solid var(--rl-bd);font-size:12px;line-height:1.4;color:var(--rl-fg3)}',
    '.rl-keys{display:flex;flex-wrap:wrap;gap:4px 14px}',
    '.rl-key{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}',
    '.rl-key .rl-m{cursor:default;font-size:12px}',
    '.rl-key b{font-weight:400;font-variant-numeric:tabular-nums}',
    '.rl-hint{margin-left:auto;font-variant-numeric:tabular-nums}',
    '.rl-hint.is-prog{color:var(--rl-fg2)}',
    /* popover */
    '.rl-pop{position:absolute;z-index:5;left:0;top:0;width:max-content;max-width:min(340px,calc(100% - 16px));background:var(--rl-s2);border:.5px solid var(--rl-bd2);border-radius:10px;padding:10px 10px 10px 12px;box-shadow:0 8px 24px rgba(0,0,0,.08),0 1px 3px rgba(0,0,0,.06);font-size:14px;line-height:1.5;color:var(--rl-fg)}',
    '.rl-pop[hidden]{display:none}',
    '.rl-ph{display:flex;align-items:center;gap:6px;min-height:28px}',
    '.rl-nav{margin-left:auto;display:inline-flex;align-items:center;padding-left:8px}',
    '.rl-nav button{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:28px!important;height:28px!important;border-radius:6px!important;color:var(--rl-fg2)!important}',
    '.rl-nav span{font-size:12px;color:var(--rl-fg3);font-variant-numeric:tabular-nums;min-width:38px;text-align:center}',
    '.rl-pr{margin:4px 0 0;color:var(--rl-fg)}',
    '.rl-pr.is-none{color:var(--rl-fg3)}',
    '.rl .rl-pd{display:inline-flex!important;align-items:center!important;gap:6px!important;margin:8px 0 0 -6px!important;padding:6px!important;border-radius:6px!important;font-size:13px!important;color:var(--rl-fg2)!important}',
    '.rl .rl-pd[aria-pressed=true]{color:var(--c-add)!important}',
    /* side by side */
    '.rl-body.rl-s{padding:0 0 4px}',
    '.rl-cmp{display:grid;grid-template-columns:1fr 1fr;font-size:15px;line-height:1.7}',
    '.rl-ch{position:sticky;top:0;padding:12px 20px 4px;font-size:12px;color:var(--rl-fg3);background:var(--rl-s2)}',
    '.rl-cc{margin:0;padding:6px 20px 10px}.rl-before{border-right:.5px solid var(--rl-bd)}',
    '.rl-before{color:var(--rl-fg2)}',
    '.rl-s .rl-m ins,.rl-s .rl-m del,.rl-s .rl-hl{border-radius:3px;padding:1px 2px;-webkit-box-decoration-break:clone;box-decoration-break:clone}',
    '.rl-s .rl-before del{color:var(--c-del);background:var(--b-del)}.rl-s .rl-after ins{color:var(--c-add);background:var(--b-add)}',
    '.rl-s .k-move del,.rl-s .k-move ins{color:var(--c-mov)!important;background:var(--b-mov)!important}',
    '.rl-s .k-punct del,.rl-s .k-punct ins{font-weight:600;padding:0 .25em}',
    '.rl-s .k-note .rl-hl{padding:0;text-decoration:underline dotted 1.5px;text-decoration-color:var(--c-note);text-underline-offset:.26em}',
    '.rl-s .rl-m.is-hot{background:none;box-shadow:0 0 0 1.5px var(--rl-fg3);border-radius:3px}',
    '.rl-s .rl-m.is-done{opacity:.38}',
    '@media (max-width:560px){.rl-bar{padding:0 8px 0 4px;overflow-x:auto;scrollbar-width:none}.rl-seg button{padding:15px 8px 14px!important}.rl-seg button[aria-pressed=true]::after{left:8px;right:8px}.rl .rl-copy span{display:none}.rl-body{padding:16px 16px 18px}.rl-cmp{grid-template-columns:1fr}.rl-ch{display:none}.rl-cc{padding:4px 16px 6px}.rl-before{border-right:0;padding-top:14px}.rl-after{padding-bottom:14px;border-bottom:.5px solid var(--rl-bd)}.rl-cc::before{content:attr(data-l);display:block;font-size:11px;color:var(--rl-fg3);margin-bottom:2px}.rl-row{padding:12px 8px 13px 8px!important}.rl-list li{padding-right:10px}.rl-foot{padding:10px 14px 11px}.rl-hint{margin-left:0;flex-basis:100%}}',
    '@media (prefers-reduced-motion:reduce){.rl *{transition:none!important}}'
  ].join('\n');

  function injectCSS() {
    if (document.getElementById('rl-css')) return;
    var st = document.createElement('style');
    st.id = 'rl-css';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  /* ---------- mount ---------- */
  function mount(root, src, opts) {
    try { return mountUnsafe(root, src, opts); } catch (err) {
      root.innerHTML = '';
      var pre = document.createElement('pre');
      pre.style.cssText = 'white-space:pre-wrap;font:14px/1.6 var(--font-mono,monospace);margin:0';
      pre.textContent = 'The review card hit an error (' + err.message + '). Marked text:\n\n' + src;
      root.appendChild(pre);
    }
  }

  function mountUnsafe(root, src, opts) {
    opts = opts || {};
    root.style.minHeight = '';
    injectCSS();
    var d = parse(src);
    var n = d.changes.length;
    var count = {};
    d.changes.forEach(function (c) { count[c.kind] = (count[c.kind] || 0) + 1; });
    var touch = window.matchMedia && window.matchMedia('(hover: none)').matches;
    var summary = n ? n + (n === 1 ? ' suggested change: ' : ' suggested changes: ') + ORDER.filter(function (k) { return count[k]; }).map(function (k) { return count[k] + ' ' + KIND[k].toLowerCase(); }).join(', ') + '.' : 'No changes suggested.';

    root.classList.add('rl');
    root.setAttribute('aria-label', 'Suggested changes');
    root.innerHTML =
      '<h2 class="rl-sr">' + esc(summary) + '</h2>' +
      '<div class="rl-bar">' +
      '<div class="rl-seg" role="group" aria-label="View">' +
      '<button type="button" data-v="tracked">Tracked</button>' +
      '<button type="button" data-v="side">Side by side</button>' +
      '<button type="button" data-v="list">Changes<span class="rl-n">' + n + '</span></button>' +
      '<button type="button" data-v="final">Final</button>' +
      '</div>' +
      '<button type="button" class="rl-copy" hidden>' + I_COPY + '<span>Copy text</span></button>' +
      '</div>' +
      '<div class="rl-body" aria-live="polite"></div>' +
      '<div class="rl-foot"><div class="rl-keys">' +
      ORDER.filter(function (k) { return count[k]; }).map(function (k) {
        return '<span class="rl-key rl-t">' + mark(SAMPLE[k], k === 'move' ? 'to' : SAMPLE[k].op, true).replace(/ data-i="undefined"/, '') + KIND[k] + ' <b>' + count[k] + '</b></span>';
      }).join('') +
      '</div><span class="rl-hint"></span></div>' +
      '<div class="rl-pop" role="dialog" aria-label="Why this change" hidden></div>';

    var bar = root.querySelector('.rl-bar');
    var body = root.querySelector('.rl-body');
    var hint = root.querySelector('.rl-hint');
    var copyBtn = root.querySelector('.rl-copy');
    var pop = root.querySelector('.rl-pop');
    var view = '', cur = -1, pinned = false, tShow = 0, tHide = 0, done = {}, nDone = 0;

    var HINTS = {
      side: n ? (touch ? 'Tap a change to see why' : 'Hover a change to see why') : 'No changes suggested',
      tracked: n ? (touch ? 'Tap a change to see why' : 'Hover a change to see why') : 'No changes suggested',
      list: n ? 'Tick each change once you’ve applied it' : '',
      final: 'Your text with every change applied'
    };

    function setView(v) {
      hide(true);
      view = v;
      bar.querySelectorAll('[data-v]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-v') === v ? 'true' : 'false'); });
      body.className = 'rl-body';
      if (v === 'tracked') { body.classList.add('rl-t'); body.innerHTML = docHTML(d); }
      else if (v === 'side') { body.classList.add('rl-s'); body.innerHTML = sideHTML(d); }
      else if (v === 'list') { body.classList.add('is-list', 'rl-t'); body.innerHTML = listHTML(d); }
      else { body.classList.add('rl-c'); body.innerHTML = cleanHTML(d.final); }
      copyBtn.hidden = v !== 'final';
      copyBtn.lastChild.textContent = 'Copy text';
      paintDone();
    }

    function isDoc() { return view === 'tracked' || view === 'side'; }

    function paintDone() {
      body.querySelectorAll('[data-i]').forEach(function (el) {
        var on = !!done[el.getAttribute('data-i')];
        el.classList.toggle('is-done', on);
        var b = el.querySelector && el.tagName === 'LI' && el.querySelector('.rl-done');
        if (b) b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      var prog = nDone > 0 && n > 0;
      hint.classList.toggle('is-prog', prog);
      hint.textContent = prog ? nDone + ' of ' + n + ' applied' : (HINTS[view] || '');
    }

    function toggleDone(i) {
      done[i] = !done[i];
      nDone += done[i] ? 1 : -1;
      paintDone();
      var pb = cur === i && pop.querySelector('.rl-pd');
      if (pb) { pb.setAttribute('aria-pressed', done[i] ? 'true' : 'false'); pb.lastChild.textContent = done[i] ? 'Applied' : 'Mark applied'; }
    }

    function pdBtn(i) {
      return '<button type="button" class="rl-pd" data-done="' + i + '" aria-pressed="' + (done[i] ? 'true' : 'false') + '">' + I_TICK + (done[i] ? 'Applied' : 'Mark applied') + '</button>';
    }

    function hot(i, on) {
      body.querySelectorAll('.rl-m[data-i="' + i + '"]').forEach(function (el) { el.classList.toggle('is-hot', on); });
    }

    function popHTML(c) {
      return '<div class="rl-ph"><span class="rl-chip k-' + c.kind + '">' + KIND[c.kind] + '</span>' +
        (c.tag ? '<span class="rl-tag">' + esc(c.tag) + '</span>' : '') +
        (n > 1 ? '<span class="rl-nav"><button type="button" data-step="-1" aria-label="Previous change">' + I_PREV + '</button><span>' + (c.i + 1) + ' of ' + n + '</span><button type="button" data-step="1" aria-label="Next change">' + I_NEXT + '</button></span>' : '') +
        '</div>' +
        '<p class="rl-pr' + (c.reason ? '' : ' is-none') + '">' + (c.reason ? esc(c.reason) : 'No reason given.') + '</p>' + pdBtn(c.i);
    }

    function place(el, py) {
      var rects = el.getClientRects();
      var r = rects[0] || el.getBoundingClientRect();
      if (py != null) for (var k = 0; k < rects.length; k++) if (py >= rects[k].top - 2 && py <= rects[k].bottom + 2) { r = rects[k]; break; }
      var base = root.getBoundingClientRect();
      var w = pop.offsetWidth, h = pop.offsetHeight;
      var left = Math.min(Math.max(8, r.left - base.left - 4), base.width - w - 8);
      var top = r.bottom - base.top + 6;
      if (top + h > base.height - 6 && r.top - base.top - h - 6 >= 4) top = r.top - base.top - h - 6;
      pop.style.left = Math.round(left) + 'px';
      pop.style.top = Math.round(top) + 'px';
    }

    function show(el, pin, py) {
      clearTimeout(tHide); clearTimeout(tShow);
      var i = +el.getAttribute('data-i');
      if (cur !== i) { if (cur >= 0) hot(cur, false); cur = i; }
      hot(i, true);
      pinned = !!pin || pinned;
      pop.innerHTML = popHTML(d.changes[i]);
      pop.hidden = false;
      place(el, py);
      void pop.offsetWidth;
      pop.classList.add('is-on');
    }

    function hide(force) {
      clearTimeout(tShow);
      if (pinned && !force) return;
      pinned = false;
      if (cur >= 0) hot(cur, false);
      cur = -1;
      pop.classList.remove('is-on');
      pop.hidden = true;
    }

    function step(dir) {
      if (cur < 0 || !n) return;
      var j = (cur + dir + n) % n;
      var el = body.querySelector('.rl-m[data-i="' + j + '"]');
      if (!el) return;
      el.focus({ preventScroll: true });
      if (el.scrollIntoView) el.scrollIntoView({ block: 'nearest' });
      show(el, true);
    }

    function goTo(i) {
      setView('tracked');
      var el = body.querySelector('.rl-m[data-i="' + i + '"]');
      if (!el) return;
      el.focus({ preventScroll: true });
      if (el.scrollIntoView) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setTimeout(function () { show(el, true); }, 60);
    }

    function copy(text) {
      function done() { copyBtn.firstChild.outerHTML = I_CHECK; copyBtn.lastChild.textContent = 'Copied'; setTimeout(function () { if (!copyBtn.hidden) { copyBtn.firstChild.outerHTML = I_COPY; copyBtn.lastChild.textContent = 'Copy text'; } }, 1600); }
      function legacy() {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'absolute'; ta.style.left = '-9999px';
        root.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (e) { copyBtn.lastChild.textContent = 'Select and copy'; }
        root.removeChild(ta);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, legacy);
      else legacy();
    }

    root.addEventListener('click', function (e) {
      var t = e.target;
      var b = t.closest('[data-v]');
      if (b) { setView(b.getAttribute('data-v')); return; }
      var dn = t.closest('[data-done]');
      if (dn) { toggleDone(+dn.getAttribute('data-done')); return; }
      if (t.closest('.rl-copy')) { copy(d.final); return; }
      var s = t.closest('[data-step]');
      if (s) { step(+s.getAttribute('data-step')); return; }
      var g = t.closest('[data-go]');
      if (g) { goTo(+g.getAttribute('data-go')); return; }
      var m = isDoc() && t.closest('.rl-body .rl-m');
      if (m) {
        var i = +m.getAttribute('data-i');
        if (pinned && cur === i) hide(true); else { m.focus({ preventScroll: true }); show(m, true, e.clientY); }
        return;
      }
      if (!t.closest('.rl-pop')) hide(true);
    });
    root.addEventListener('pointerover', function (e) {
      if (e.pointerType !== 'mouse' || pinned || !isDoc()) return;
      var m = e.target.closest('.rl-body .rl-m');
      if (m) { clearTimeout(tHide); var y = e.clientY; clearTimeout(tShow); tShow = setTimeout(function () { show(m, false, y); }, 70); }
      else if (e.target.closest('.rl-pop')) clearTimeout(tHide);
    });
    root.addEventListener('pointerout', function (e) {
      if (e.pointerType !== 'mouse' || pinned) return;
      var to = e.relatedTarget;
      if (to && to.closest && (to.closest('.rl-pop') || (to.closest('.rl-body .rl-m') && +to.closest('.rl-m').getAttribute('data-i') === cur))) return;
      clearTimeout(tShow);
      clearTimeout(tHide); tHide = setTimeout(function () { hide(); }, 160);
    });
    root.addEventListener('focusin', function (e) {
      var m = isDoc() && e.target.closest && e.target.closest('.rl-body .rl-m');
      if (m && +m.getAttribute('data-i') !== cur) show(m, false);
    });
    root.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && cur >= 0) {
        var i = cur; hide(true);
        var el = body.querySelector('.rl-m[data-i="' + i + '"]'); if (el) el.focus();
      } else if ((e.key === 'Enter' || e.key === ' ') && e.target.classList && e.target.classList.contains('rl-m')) {
        e.preventDefault(); show(e.target, true);
      } else if (cur >= 0 && pinned && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && e.target.closest('.rl-body,.rl-pop')) {
        e.preventDefault(); step(e.key === 'ArrowRight' ? 1 : -1);
      }
    });
    document.addEventListener('click', function (e) { if (!root.contains(e.target)) hide(true); });
    window.addEventListener('resize', function () { hide(true); });

    var start = { tracked: 1, side: 1, list: 1, final: 1 }[opts.view] ? opts.view : 'tracked';
    setView(start);
    return { data: d, view: setView };
  }

  function auto() {
    var list = document.querySelectorAll('script[type="text/redline"]');
    for (var k = 0; k < list.length; k++) {
      var s = list[k];
      if (s.getAttribute('data-done')) continue;
      s.setAttribute('data-done', '1');
      var host = document.createElement('section');
      s.parentNode.insertBefore(host, s);
      mount(host, s.textContent, { view: s.getAttribute('data-view') });
    }
  }

  window.Redline = {
    version: VERSION,
    parse: parse,
    auto: auto,
    render: function (el, src, o) { if (typeof el === 'string') el = document.querySelector(el); return mount(el, src, o); }
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto); else auto();
})();
