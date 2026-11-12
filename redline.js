/*! redline v1.0.1 | track-changes card for Claude chat | MIT */
(function () {
  'use strict';
  if (window.Redline && window.Redline.version) { window.Redline.auto(); return; }

  var VERSION = '1.0.1';
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

  /* ---------- parse ---------- */
  function parse(src) {
    src = String(src || '').replace(/<\\\//g, '</').replace(/\r\n?/g, '\n').replace(/^[ \t]*\n+|\n+[ \t]*$/g, '');
    var segs = [], changes = [], moves = {}, pos = 0, m;
    function push(c, op) {
      if (c.i == null) { c.i = changes.length; changes.push(c); }
      segs.push({ t: 'm', i: c.i, op: op });
    }
    RE.lastIndex = 0;
    while ((m = RE.exec(src))) {
      var adj = m.index === pos && segs.length && segs[segs.length - 1].t === 'm';
      if (m.index > pos) segs.push({ t: 'x', s: src.slice(pos, m.index) });
      pos = RE.lastIndex;
      if (m[6] !== undefined) {
        var r = reasonOf(m[6]);
        if (adj) {
          var c0 = changes[segs[segs.length - 1].i];
          c0.reason = c0.reason ? c0.reason + ' ' + r.text : r.text;
          c0.tag = c0.tag || r.tag;
        } else push({ op: 'pt', kind: 'note', reason: r.text, tag: r.tag }, 'pt');
      } else if (m[1] !== undefined) push({ op: 'add', kind: 'add', nw: m[1] }, 'add');
      else if (m[2] !== undefined) push({ op: 'del', kind: 'del', old: m[2] }, 'del');
      else if (m[3] !== undefined) {
        if (!m[4]) push({ op: 'del', kind: 'del', old: m[3] }, 'del');
        else if (!m[3]) push({ op: 'add', kind: 'add', nw: m[4] }, 'add');
        else push({ op: 'sub', kind: 'sub', old: m[3], nw: m[4] }, 'sub');
      } else if (m[5] !== undefined) push({ op: 'hl', kind: 'note', s: m[5] }, 'hl');
      else if (m[7] !== undefined) {
        var a = moves[m[7]] || (moves[m[7]] = { op: 'move', kind: 'move', text: '' });
        a.text = m[8]; a.from = true; push(a, 'from');
      } else if (m[9] !== undefined) {
        var b = moves[m[9]] || (moves[m[9]] = { op: 'move', kind: 'move', text: '' });
        b.to = true; push(b, 'to');
      }
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
  function mark(c, op, inert) {
    var a = inert ? ' data-i="' + c.i + '"' : attrs(c);
    var k = '<span class="rl-m k-' + c.kind + ' o-' + op + '"' + a + '>';
    var badge = '<span class="rl-badge">' + I_MOVE + c.n + '</span>';
    var cn = '<span class="rl-cn">' + c.n + '</span>';
    switch (op) {
      case 'add': return k + '<ins>' + br(c.nw) + '</ins></span>';
      case 'del': return k + '<del>' + br(c.old) + '</del></span>';
      case 'sub': return k + '<del>' + br(c.old) + '</del><ins>' + br(c.nw) + '</ins></span>';
      case 'hl': return k + '<span class="rl-hl">' + br(c.s) + '</span>' + cn + '</span>';
      case 'pt': return k + '<span class="rl-pt">' + I_NOTE + '</span>' + cn + '</span>';
      case 'from': return k + badge + '<del>' + br(c.text) + '</del></span>';
      case 'to': return k + badge + '<ins>' + br(c.text) + '</ins></span>';
    }
    return '';
  }

  function docHTML(d, interactive) {
    var paras = [{ h: '', c: false }];
    d.segs.forEach(function (s) {
      if (s.t === 'x') {
        s.s.split(/\n{2,}/).forEach(function (p, k) {
          if (k) paras.push({ h: '', c: false });
          paras[paras.length - 1].h += br(p);
        });
      } else {
        var P = paras[paras.length - 1];
        P.h += mark(d.changes[s.i], s.op, !interactive);
        P.c = true;
      }
    });
    return paras.map(function (p) {
      return '<p class="rl-p' + (p.c ? ' rl-chg' : '') + '">' + (p.h || '<br>') + '</p>';
    }).join('');
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
      return '<li><button type="button" class="rl-row" data-go="' + c.i + '">' +
        '<span class="rl-num">' + (c.i + 1) + '</span>' +
        '<span class="rl-rb"><span class="rl-rh">' + head + '</span>' +
        '<span class="rl-ctx">' + body + '</span>' +
        (c.reason ? '<span class="rl-why">' + esc(c.reason) + '</span>' : '') +
        '</span></button></li>';
    }).join('') + '</ol>';
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
    '--h-add:#1D9E75;--h-del:#E24B4A;--h-pun:#BA7517;--h-mov:#7F77DD;--h-note:#378ADD;',
    '--c-add:color-mix(in srgb,var(--h-add) 62%,var(--rl-fg));--c-del:color-mix(in srgb,var(--h-del) 62%,var(--rl-fg));--c-pun:color-mix(in srgb,var(--h-pun) 62%,var(--rl-fg));--c-mov:color-mix(in srgb,var(--h-mov) 62%,var(--rl-fg));--c-note:color-mix(in srgb,var(--h-note) 62%,var(--rl-fg));',
    '--b-add:color-mix(in srgb,var(--h-add) 15%,transparent);--b-del:color-mix(in srgb,var(--h-del) 13%,transparent);--b-pun:color-mix(in srgb,var(--h-pun) 22%,transparent);--b-mov:color-mix(in srgb,var(--h-mov) 16%,transparent);--b-note:color-mix(in srgb,var(--h-note) 17%,transparent);',
    'position:relative;display:block;color:var(--rl-fg);font-family:var(--font-sans,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif);background:var(--rl-s2);border:.5px solid var(--rl-bd2);border-radius:12px;margin:4px 0;-webkit-tap-highlight-color:transparent;text-align:left}',
    '.rl *,.rl *::before,.rl *::after{box-sizing:border-box}',
    '.rl ::selection{background:color-mix(in srgb,var(--h-note) 30%,transparent)}',
    '.rl-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;margin:-1px;padding:0;border:0}',
    '.rl button{font:inherit;color:inherit;background:none;border:0;margin:0;box-shadow:none;cursor:pointer;height:auto;min-width:0;-webkit-user-select:none;user-select:none;touch-action:manipulation;transform:none}',
    '.rl button:focus-visible,.rl .rl-m:focus-visible{outline:2px solid color-mix(in srgb,var(--h-note) 70%,transparent);outline-offset:2px}',
    '.rl-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 12px;border-bottom:.5px solid var(--rl-bd)}',
    '.rl-seg{display:inline-flex;gap:2px;padding:2px;background:var(--rl-s1);border-radius:var(--rl-r)}',
    '.rl-seg button{font-size:13px;line-height:1;padding:8px 12px;min-height:30px;border-radius:calc(var(--rl-r) - 2px);color:var(--rl-fg2);transition:background-color .15s,color .15s}',
    '.rl-seg button[aria-pressed=true]{background:var(--rl-s2);color:var(--rl-fg);box-shadow:0 0 0 .5px var(--rl-bd2)}',
    '.rl-n{margin-left:5px;color:var(--rl-fg3);font-variant-numeric:tabular-nums}',
    '.rl .rl-copy{margin-left:auto;display:inline-flex;align-items:center;gap:6px;font-size:13px;padding:7px 10px;border-radius:var(--rl-r);color:var(--rl-fg2)}',
    '.rl-copy[hidden]{display:none}',
    '@media (hover:hover){.rl-seg button:hover{color:var(--rl-fg)}.rl-copy:hover{background:var(--rl-s1);color:var(--rl-fg)}.rl-row:hover{background:var(--rl-s1)}.rl-pop button:hover{background:var(--rl-s1);color:var(--rl-fg)}}',
    '.rl-body{padding:18px 22px 20px;font-size:16px;line-height:1.7;overflow-wrap:break-word}',
    '.rl-p{margin:0 0 .85em}.rl-p:last-child{margin-bottom:0}',
    '.rl-empty{margin:0;color:var(--rl-fg2);font-size:14px}',
    '.rl ins,.rl del{text-decoration:none;color:inherit;background:none}',
    '.rl-m{border-radius:3px;cursor:pointer;-webkit-box-decoration-break:clone;box-decoration-break:clone;transition:box-shadow .12s}',
    '.rl-m ins,.rl-m del,.rl-hl,.rl-badge,.rl-pt{-webkit-box-decoration-break:clone;box-decoration-break:clone}',
    '.rl-cn{display:none}',
    '.rl-badge{display:inline-flex;align-items:center;gap:1px;font-size:11px;line-height:1;font-weight:500;font-variant-numeric:tabular-nums;color:var(--c-mov);vertical-align:.12em;margin-right:3px;padding:2px 4px 2px 3px;border-radius:4px;background:var(--b-mov)}',
    '.rl-pt{display:inline-flex;vertical-align:-.12em;color:var(--c-note);padding:2px 3px;border-radius:4px;background:var(--b-note);margin:0 1px}',
    /* tracked: highlight + decoration */
    '.rl-t .k-add ins,.rl-t .k-sub ins{background:var(--b-add);color:var(--c-add);text-decoration:underline 1px;text-underline-offset:.22em;border-radius:3px;padding:1px 1px}',
    '.rl-t .k-del del,.rl-t .k-sub del{background:var(--b-del);color:var(--c-del);text-decoration:line-through 1.5px;border-radius:3px;padding:1px 1px}',
    '.rl-t .k-sub del+ins{margin-left:2px}',
    '.rl-t .k-punct ins,.rl-t .k-punct del{background:var(--b-pun);color:var(--c-pun);font-weight:500;border-radius:3px;padding:1px .22em;margin:0 1px}',
    '.rl-t .k-punct ins{text-decoration:underline 1.5px;text-underline-offset:.22em}.rl-t .k-punct del{text-decoration:line-through 1.5px}',
    '.rl-t .k-move ins,.rl-t .k-move del{background:var(--b-mov);color:var(--c-mov);border-radius:3px;padding:1px 1px}',
    '.rl-t .k-move del{text-decoration:line-through double 1px}.rl-t .k-move ins{text-decoration:underline double 1px;text-underline-offset:.2em}',
    '.rl-t .k-note .rl-hl{background:var(--b-note);border-radius:3px;padding:1px 1px;text-decoration:underline dotted 1.5px;text-decoration-color:var(--c-note);text-underline-offset:.24em}',
    /* redline: text formatting, Word style */
    '.rl-r .k-add ins,.rl-r .k-sub ins{color:var(--c-add);text-decoration:underline 1.5px;text-underline-offset:.18em}',
    '.rl-r .k-del del,.rl-r .k-sub del{color:var(--c-del);text-decoration:line-through 1.5px}',
    '.rl-r .k-sub del+ins,.rl-r .k-punct del+ins{margin-left:.18em}',
    '.rl-r .k-punct ins,.rl-r .k-punct del{color:var(--c-pun);font-weight:500;padding:0 .14em;border-radius:2px;background:color-mix(in srgb,var(--h-pun) 11%,transparent)}',
    '.rl-r .k-punct ins{text-decoration:underline 1.5px;text-underline-offset:.18em}.rl-r .k-punct del{text-decoration:line-through 1.5px}',
    '.rl-r .k-move ins,.rl-r .k-move del{color:var(--c-mov)}',
    '.rl-r .k-move del{text-decoration:line-through double 1px}.rl-r .k-move ins{text-decoration:underline double 1px;text-underline-offset:.18em}',
    '.rl-r .rl-badge{background:none;padding:0 2px 0 0;vertical-align:super;font-size:11px}',
    '.rl-r .k-note .rl-hl{text-decoration:underline dotted 1.5px;text-decoration-color:var(--c-note);text-underline-offset:.22em}',
    '.rl-r .rl-pt{display:none}',
    '.rl-r .rl-cn{display:inline;font-size:11px;line-height:0;font-weight:500;vertical-align:super;color:var(--c-note);margin-left:1px;font-variant-numeric:tabular-nums}',
    '.rl-r .rl-chg{position:relative}.rl-r .rl-chg::before{content:"";position:absolute;left:-13px;top:.25em;bottom:.25em;width:2px;border-radius:0;background:var(--rl-bd2)}',
    /* focus/hover highlight of a change */
    '.rl-m.is-hot{box-shadow:0 0 0 1.5px var(--ring,var(--rl-fg3))}',
    '.k-add{--ring:color-mix(in srgb,var(--h-add) 70%,transparent)}.k-del{--ring:color-mix(in srgb,var(--h-del) 70%,transparent)}.k-punct{--ring:color-mix(in srgb,var(--h-pun) 75%,transparent)}.k-move{--ring:color-mix(in srgb,var(--h-mov) 75%,transparent)}.k-note{--ring:color-mix(in srgb,var(--h-note) 70%,transparent)}.k-sub{--ring:var(--rl-fg3)}',
    '.rl-m:focus-visible{outline:none;box-shadow:0 0 0 1.5px var(--ring,var(--rl-fg3))}',
    /* clean */
    '.rl-c .rl-p{color:var(--rl-fg)}',
    /* list */
    '.rl-body.is-list{padding:4px 0}',
    '.rl-list{list-style:none;margin:0;padding:0}',
    '.rl-list li+li{border-top:.5px solid var(--rl-bd)}',
    '.rl-row{display:grid!important;grid-template-columns:22px minmax(0,1fr);gap:10px;width:100%;text-align:left;padding:12px 22px 13px 16px!important;border-radius:0!important;transition:background-color .15s}',
    '.rl-num{font-size:13px;line-height:22px;color:var(--rl-fg3);font-variant-numeric:tabular-nums;text-align:right}',
    '.rl-rb{display:flex;flex-direction:column;gap:5px;min-width:0}',
    '.rl-rh{display:flex;align-items:center;gap:8px;font-size:13px;line-height:22px;color:var(--rl-fg2)}',
    '.rl-ctx{display:flex;flex-direction:column;gap:3px;font-size:15px;line-height:1.6;color:var(--rl-fg)}',
    '.rl-ln{display:flex;gap:8px;align-items:baseline}',
    '.rl-lab{flex:none;width:34px;font-size:12px;color:var(--rl-fg3)}',
    '.rl-cx{color:var(--rl-fg2)}',
    '.rl-why{font-size:13px;line-height:1.5;color:var(--rl-fg2)}',
    '.rl-chip{display:inline-flex;align-items:center;font-size:12px;line-height:1;font-weight:500;padding:4px 7px;border-radius:5px;color:var(--c,var(--rl-fg2));background:var(--b,var(--rl-s1))}',
    '.rl-chip.k-add{--c:var(--c-add);--b:var(--b-add)}.rl-chip.k-del{--c:var(--c-del);--b:var(--b-del)}.rl-chip.k-punct{--c:var(--c-pun);--b:var(--b-pun)}.rl-chip.k-move{--c:var(--c-mov);--b:var(--b-mov)}.rl-chip.k-note{--c:var(--c-note);--b:var(--b-note)}',
    '.rl-tag{font-size:12px;color:var(--rl-fg2)}',
    /* footer */
    '.rl-foot{display:flex;flex-wrap:wrap;align-items:center;gap:8px 16px;padding:10px 16px 11px;border-top:.5px solid var(--rl-bd);font-size:13px;line-height:1.4;color:var(--rl-fg2)}',
    '.rl-keys{display:flex;flex-wrap:wrap;gap:6px 14px}',
    '.rl-key{display:inline-flex;align-items:center;gap:6px;white-space:nowrap}',
    '.rl-key .rl-m{cursor:default;font-size:13px;line-height:1.4}',
    '.rl-key b{font-weight:400;color:var(--rl-fg3);font-variant-numeric:tabular-nums}',
    '.rl-hint{margin-left:auto;color:var(--rl-fg3)}',
    /* popover */
    '.rl-pop{position:absolute;z-index:5;left:0;top:0;width:max-content;max-width:min(330px,calc(100% - 16px));background:var(--rl-s2);border:.5px solid var(--rl-bd2);border-radius:10px;padding:9px 10px 10px 12px;box-shadow:0 8px 24px rgba(0,0,0,.08),0 1px 3px rgba(0,0,0,.06);font-size:14px;line-height:1.5;color:var(--rl-fg);pointer-events:auto}',
    '.rl-pop[hidden]{display:none}',
    '.rl-ph{display:flex;align-items:center;gap:8px;min-height:26px}',
    '.rl-nav{margin-left:auto;display:inline-flex;align-items:center;gap:0;padding-left:8px}',
    '.rl-nav button{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:6px;color:var(--rl-fg2)}',
    '.rl-nav span{font-size:12px;color:var(--rl-fg3);font-variant-numeric:tabular-nums;min-width:38px;text-align:center}',
    '.rl-pr{margin:5px 0 0;color:var(--rl-fg)}',
    '.rl-pr.is-none{color:var(--rl-fg3)}',
    '@media (max-width:520px){.rl-bar{padding:8px}.rl-bar .rl-seg:first-child{flex:1 1 100%}.rl-bar .rl-seg:first-child button{flex:1}.rl-body{padding:16px 16px 18px}.rl-r.rl-body{padding-left:20px}.rl-r .rl-chg::before{left:-11px}.rl-row{padding:12px 16px 13px 10px!important}.rl-foot{padding:10px 14px 11px}.rl-hint{margin-left:0;flex-basis:100%}}',
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
    opts = opts || {};
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
      '<div class="rl-seg" role="group" aria-label="Markup">' +
      '<button type="button" data-v="tracked">Tracked</button>' +
      '<button type="button" data-v="redline">Redline</button>' +
      '<button type="button" data-v="list">Changes<span class="rl-n">' + n + '</span></button>' +
      '</div>' +
      '<div class="rl-seg" role="group" aria-label="Clean text">' +
      '<button type="button" data-v="original">Original</button>' +
      '<button type="button" data-v="final">Final</button>' +
      '</div>' +
      '<button type="button" class="rl-copy" hidden>' + I_COPY + '<span>Copy</span></button>' +
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
    var view = '', cur = -1, pinned = false, tShow = 0, tHide = 0;

    var HINTS = {
      tracked: n ? (touch ? 'Tap a change to see why' : 'Hover a change to see why') : 'No changes suggested',
      redline: n ? (touch ? 'Tap a change to see why' : 'Hover a change to see why') : 'No changes suggested',
      list: n ? 'Select a change to find it in the text' : '',
      original: 'Your text, no markup',
      final: 'Your text with every change applied'
    };

    function setView(v) {
      hide(true);
      view = v;
      bar.querySelectorAll('[data-v]').forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-v') === v ? 'true' : 'false'); });
      body.className = 'rl-body';
      if (v === 'tracked' || v === 'redline') { body.classList.add(v === 'tracked' ? 'rl-t' : 'rl-r'); body.innerHTML = docHTML(d, true); }
      else if (v === 'list') { body.classList.add('is-list', 'rl-t'); body.innerHTML = listHTML(d); }
      else { body.classList.add('rl-c'); body.innerHTML = cleanHTML(v === 'original' ? d.original : d.final); }
      copyBtn.hidden = !(v === 'original' || v === 'final');
      copyBtn.lastChild.textContent = 'Copy';
      hint.textContent = HINTS[v];
    }

    function isDoc() { return view === 'tracked' || view === 'redline'; }

    function hot(i, on) {
      body.querySelectorAll('.rl-m[data-i="' + i + '"]').forEach(function (el) { el.classList.toggle('is-hot', on); });
    }

    function popHTML(c) {
      return '<div class="rl-ph"><span class="rl-chip k-' + c.kind + '">' + KIND[c.kind] + '</span>' +
        (c.tag ? '<span class="rl-tag">' + esc(c.tag) + '</span>' : '') +
        (n > 1 ? '<span class="rl-nav"><button type="button" data-step="-1" aria-label="Previous change">' + I_PREV + '</button><span>' + (c.i + 1) + ' of ' + n + '</span><button type="button" data-step="1" aria-label="Next change">' + I_NEXT + '</button></span>' : '') +
        '</div>' +
        '<p class="rl-pr' + (c.reason ? '' : ' is-none') + '">' + (c.reason ? esc(c.reason) : 'No reason given.') + '</p>';
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
      function done() { copyBtn.firstChild.outerHTML = I_CHECK; copyBtn.lastChild.textContent = 'Copied'; setTimeout(function () { if (!copyBtn.hidden) { copyBtn.firstChild.outerHTML = I_COPY; copyBtn.lastChild.textContent = 'Copy'; } }, 1600); }
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
      if (t.closest('.rl-copy')) { copy(view === 'original' ? d.original : d.final); return; }
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

    var start = { tracked: 1, redline: 1, list: 1, original: 1, final: 1 }[opts.view] ? opts.view : 'tracked';
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
