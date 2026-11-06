/* BRVMexa — outils de dessin du graphique, inspirés de TradingView.
   Ligne de tendance, ligne horizontale, rectangle, position longue, retracement de Fibonacci,
   mesure, pinceau, texte et étiquette de prix. Chaque tracé est ancré sur le temps et le prix :
   il suit le graphique quand on zoome ou qu'on le fait défiler, et se déplace à la souris ou au doigt. */
(function () {
  'use strict';

  var nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
  var nf2 = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var tidy = function (s) { return s.replace(/[  ]/g, ' '); };
  var px = function (v) { return v == null || !isFinite(v) ? '—' : tidy((Math.abs(v) >= 100 ? nf0 : nf2).format(v)); };
  var pc = function (v) { return (v > 0 ? '+' : '') + tidy(nf2.format(v)) + ' %'; };
  var FONT = '600 11px Inter, system-ui, sans-serif';
  var HIT = 7;
  // Couleurs primaires et secondaires, plus le vert BRVMexa
  var COLORS = [['#FF1F1F', 'Rouge'], ['#1E6BFF', 'Bleu'], ['#FFD600', 'Jaune'], ['#16C47F', 'Vert'], ['#FF8A00', 'Orange'], ['#9B4DFF', 'Violet'],
    ['#FF4FA3', 'Rose'], ['#00C8E0', 'Cyan'], ['#FFFFFF', 'Blanc'], ['#9AA7AF', 'Gris'], ['#000000', 'Noir']];
  var FIB = [[0, '#9AA7AF'], [0.236, '#F0526B'], [0.382, '#F2B33D'], [0.5, '#16C47F'], [0.618, '#2EC5CE'], [0.786, '#4C9BFF'], [1, '#9AA7AF']];
  var ONE_CLICK = { hline: 1, text: 1, label: 1, long: 1, short: 1 };

  function rgba(hex, a) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function distSeg(x, y, x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1, len = dx * dx + dy * dy;
    var t = len ? Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / len)) : 0;
    return Math.hypot(x - (x1 + t * dx), y - (y1 + t * dy));
  }
  function box(ctx, x, y, text, bg, fg, align) {
    ctx.font = FONT;
    var w = ctx.measureText(text).width + 14, h = 20;
    var bx = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
    ctx.fillStyle = bg;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(bx, y - h / 2, w, h, 4); else ctx.rect(bx, y - h / 2, w, h);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(text, bx + 7, y + 0.5);
    return { x: bx, y: y - h / 2, w: w, h: h };
  }

  function ink(hex) { var n = parseInt(hex.slice(1), 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#0A0F1A' : '#FFFFFF'; }

  function create(o) {
    var chart = o.chart, host = o.host, getSeries = o.getSeries, pts = o.pts, lastIdx = pts.length - 1;
    var canvas = document.createElement('canvas');
    canvas.className = 'cx-draw';
    host.appendChild(canvas);
    var ctx = canvas.getContext('2d');
    var editor = document.createElement('input');
    editor.className = 'cx-text-edit'; editor.type = 'text'; editor.maxLength = 120; editor.hidden = true;
    editor.setAttribute('aria-label', 'Texte à placer sur le graphique');
    host.appendChild(editor);

    var KEY = 'bx-draw-' + o.sym;
    var drawings = [], undo = [], selected = null, tool = 'cross', color = COLORS[3][0], width = 2, visible = true, magnet = true, FW = 0;
    var capital = 1000000, cur = null, drag = null, pending = null, hover = null, W = 0, H = 0, editing = null, seq = 1;
    try { var saved = JSON.parse(localStorage.getItem(KEY) || 'null'); if (saved && saved.d) { drawings = saved.d; capital = saved.c || capital; } } catch (e) {}
    drawings.forEach(function (d) { d.id = seq++; });

    // ───────── Conversions temps / prix ↔ pixels (index de séance fractionnaire) ─────────
    var ts = function () { return chart.timeScale(); };
    var geo = function () {
      var a = ts().logicalToCoordinate(0), b = ts().logicalToCoordinate(1);
      return a == null || b == null ? null : { x0: a, s: b - a };
    };
    var G = null;
    var X = function (l) { return G.x0 + l * G.s; };
    var L = function (x) { return (x - G.x0) / G.s; };
    var Y = function (p) { var y = getSeries().priceToCoordinate(p); return y == null ? NaN : y; };
    var P = function (y) { return getSeries().coordinateToPrice(y); };
    var lastClose = pts[lastIdx].c;

    function save() {
      try { localStorage.setItem(KEY, JSON.stringify({ c: capital, d: drawings.map(function (d) { var c = Object.assign({}, d); delete c.id; return c; }) })); } catch (e) {}
      if (o.onChange) o.onChange({ count: drawings.length, selected: selected });
    }
    function snapshot() { undo.push(JSON.stringify(drawings)); if (undo.length > 50) undo.shift(); }

    // ───────── Géométrie de chaque type de tracé ─────────
    var T = {
      trend: {
        handles: function (d) { return [['a', X(d.a.l), Y(d.a.p)], ['b', X(d.b.l), Y(d.b.p)]]; },
        hit: function (d, x, y) { return distSeg(x, y, X(d.a.l), Y(d.a.p), X(d.b.l), Y(d.b.p)) < HIT; },
        draw: function (d) {
          var x1 = X(d.a.l), y1 = Y(d.a.p), x2 = X(d.b.l), y2 = Y(d.b.p);
          line(x1, y1, x2, y2, d.color, d.w);
          var ch = (d.b.p / d.a.p - 1) * 100, n = Math.round(Math.abs(d.b.l - d.a.l));
          endPrice(x1, y1, x2, d.a.p, d.color); endPrice(x2, y2, x1, d.b.p, d.color);
          if (selected === d || hover === d) box(ctx, (x1 + x2) / 2, (y1 + y2) / 2 - 16, pc(ch) + ' · ' + n + ' séances', rgba(d.color, 0.92), ink(d.color), 'center');
        }
      },
      hline: {
        handles: function (d) { return [['a', Math.min(W - 70, 60), Y(d.a.p)]]; },
        hit: function (d, x, y) { return Math.abs(y - Y(d.a.p)) < HIT; },
        draw: function (d) {
          var y = Y(d.a.p);
          line(0, y, W, y, d.color, d.w);
          box(ctx, W - 4, y, px(d.a.p) + ' F · ' + pc((d.a.p / lastClose - 1) * 100) + ' du cours', d.color, ink(d.color), 'right');
        }
      },
      rect: {
        handles: function (d) { return [['a', X(d.a.l), Y(d.a.p)], ['b', X(d.b.l), Y(d.b.p)], ['c', X(d.a.l), Y(d.b.p)], ['d', X(d.b.l), Y(d.a.p)]]; },
        hit: function (d, x, y) {
          var x1 = Math.min(X(d.a.l), X(d.b.l)), x2 = Math.max(X(d.a.l), X(d.b.l)), y1 = Math.min(Y(d.a.p), Y(d.b.p)), y2 = Math.max(Y(d.a.p), Y(d.b.p));
          return x >= x1 - HIT && x <= x2 + HIT && y >= y1 - HIT && y <= y2 + HIT;
        },
        draw: function (d) {
          var x1 = X(d.a.l), y1 = Y(d.a.p), x2 = X(d.b.l), y2 = Y(d.b.p);
          ctx.fillStyle = rgba(d.color, 0.14); ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
          ctx.strokeStyle = d.color; ctx.lineWidth = d.w; ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
        },
        set: function (d, k, l, p) {
          if (k === 'c') { d.a.l = l; d.b.p = p; } else if (k === 'd') { d.b.l = l; d.a.p = p; } else { d[k].l = l; d[k].p = p; }
        }
      },
      fib: {
        handles: function (d) { return [['a', X(d.a.l), Y(d.a.p)], ['b', X(d.b.l), Y(d.b.p)]]; },
        hit: function (d, x, y) {
          var x1 = Math.min(X(d.a.l), X(d.b.l)), x2 = Math.max(X(d.a.l), X(d.b.l)) + 140;
          if (x < x1 - HIT || x > x2) return false;
          return FIB.some(function (f) { return Math.abs(y - Y(d.b.p + (d.a.p - d.b.p) * f[0])) < HIT; }) || distSeg(x, y, X(d.a.l), Y(d.a.p), X(d.b.l), Y(d.b.p)) < HIT;
        },
        draw: function (d) {
          var x1 = Math.min(X(d.a.l), X(d.b.l)), x2 = Math.max(X(d.a.l), X(d.b.l)) + 140;
          var prev = null;
          FIB.forEach(function (f) {
            var p = d.b.p + (d.a.p - d.b.p) * f[0], y = Y(p);
            if (prev != null) { ctx.fillStyle = rgba(f[1], 0.08); ctx.fillRect(x1, Math.min(prev, y), x2 - x1, Math.abs(y - prev)); }
            line(x1, y, x2, y, f[1], 1);
            ctx.font = FONT; ctx.fillStyle = f[1]; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
            ctx.fillText(tidy(nf2.format(f[0] * 100)).replace(',00', '') + ' % : ' + px(p) + ' F', x1 + 4, y - 2);
            prev = y;
          });
          dashed(X(d.a.l), Y(d.a.p), X(d.b.l), Y(d.b.p), '#9AA7AF');
        }
      },
      measure: {
        handles: function (d) { return [['a', X(d.a.l), Y(d.a.p)], ['b', X(d.b.l), Y(d.b.p)]]; },
        hit: T_rectHit,
        draw: function (d) {
          var x1 = X(d.a.l), y1 = Y(d.a.p), x2 = X(d.b.l), y2 = Y(d.b.p), up = d.b.p >= d.a.p, col = up ? '#4C9BFF' : '#F0526B';
          ctx.fillStyle = rgba(col, 0.16); ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
          arrow(x1, (y1 + y2) / 2, x2, (y1 + y2) / 2, col); arrow((x1 + x2) / 2, y1, (x1 + x2) / 2, y2, col);
          var n = Math.round(d.b.l - d.a.l), diff = d.b.p - d.a.p;
          box(ctx, (x1 + x2) / 2, Math.max(y1, y2) + 16, (diff >= 0 ? '+' : '−') + px(Math.abs(diff)) + ' F (' + pc((d.b.p / d.a.p - 1) * 100) + ') · ' + Math.abs(n) + ' séances', col, '#fff', 'center');
        }
      },
      brush: {
        handles: function () { return []; },
        hit: function (d, x, y) {
          for (var i = 1; i < d.pts.length; i++) if (distSeg(x, y, X(d.pts[i - 1].l), Y(d.pts[i - 1].p), X(d.pts[i].l), Y(d.pts[i].p)) < HIT) return true;
          return false;
        },
        draw: function (d) {
          if (d.pts.length < 2) return;
          ctx.strokeStyle = d.color; ctx.lineWidth = d.w + 1; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(X(d.pts[0].l), Y(d.pts[0].p));
          for (var i = 1; i < d.pts.length; i++) ctx.lineTo(X(d.pts[i].l), Y(d.pts[i].p));
          ctx.stroke();
        },
        move: function (d, dl, dp) { d.pts.forEach(function (q) { q.l += dl; q.p += dp; }); }
      },
      text: {
        handles: function () { return []; },
        hit: function (d, x, y) {
          ctx.font = '700 ' + (12 + d.w * 2) + 'px Inter, system-ui, sans-serif';
          var w = ctx.measureText(d.text).width, h = 14 + d.w * 2, x0 = X(d.a.l), y0 = Y(d.a.p);
          return x >= x0 - 4 && x <= x0 + w + 4 && y >= y0 - h && y <= y0 + 6;
        },
        draw: function (d) {
          ctx.font = '700 ' + (12 + d.w * 2) + 'px Inter, system-ui, sans-serif';
          ctx.fillStyle = d.color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
          ctx.fillText(d.text, X(d.a.l), Y(d.a.p));
        }
      },
      label: {
        handles: function (d) { return [['a', X(d.a.l), Y(d.a.p)]]; },
        hit: function (d, x, y) { var x0 = X(d.a.l), y0 = Y(d.a.p); return Math.abs(x - x0) < 60 && y <= y0 + HIT && y >= y0 - 40; },
        draw: function (d) {
          var x0 = X(d.a.l), y0 = Y(d.a.p);
          ctx.fillStyle = d.color; ctx.beginPath(); ctx.arc(x0, y0, 3.5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.moveTo(x0, y0 - 6); ctx.lineTo(x0 - 6, y0 - 14); ctx.lineTo(x0 + 6, y0 - 14); ctx.fill();
          box(ctx, x0, y0 - 24, px(d.a.p) + ' F', d.color, ink(d.color), 'center');
        }
      },
      position: {
        handles: function (d) { var x1 = X(d.l1); return [['tp', x1, Y(d.tp)], ['sl', x1, Y(d.sl)], ['e', x1, Y(d.e)], ['w', X(d.l2), Y(d.e)]]; },
        hit: function (d, x, y) {
          var x1 = Math.min(X(d.l1), X(d.l2)), x2 = Math.max(X(d.l1), X(d.l2)), ys = [Y(d.tp), Y(d.sl)];
          return x >= x1 - HIT && x <= x2 + HIT && y >= Math.min.apply(null, ys) - HIT && y <= Math.max.apply(null, ys) + HIT;
        },
        draw: function (d) {
          var long = d.type === 'long', x1 = X(d.l1), x2 = X(d.l2), ye = Y(d.e), yt = Y(d.tp), ys = Y(d.sl);
          var xl = Math.min(x1, x2), w = Math.abs(x2 - x1);
          ctx.fillStyle = 'rgba(22,196,127,.30)'; ctx.fillRect(xl, Math.min(ye, yt), w, Math.abs(yt - ye));
          ctx.fillStyle = 'rgba(240,82,107,.28)'; ctx.fillRect(xl, Math.min(ye, ys), w, Math.abs(ys - ye));
          line(xl, yt, xl + w, yt, '#16C47F', 1); line(xl, ys, xl + w, ys, '#F0526B', 1);
          line(xl, ye, xl + w, ye, '#9AA7AF', 1);
          var qty = Math.max(1, Math.floor(capital / d.e));
          var gain = Math.abs(d.tp - d.e), loss = Math.abs(d.e - d.sl), rr = loss ? gain / loss : 0;
          var cur = long ? (lastClose / d.e - 1) * 100 : (d.e / lastClose - 1) * 100;
          var cx = xl + w / 2;
          box(ctx, cx, long ? yt - 14 : yt + 14, 'Objectif : ' + px(d.tp) + ' F (' + pc((d.tp / d.e - 1) * 100) + ') · Gain : ' + px(gain * qty) + ' F', '#0E9A62', '#fff', 'center');
          box(ctx, cx, long ? ys + 14 : ys - 14, 'Stop : ' + px(d.sl) + ' F (' + pc((d.sl / d.e - 1) * 100) + ') · Perte : ' + px(loss * qty) + ' F', '#D63C55', '#fff', 'center');
          if (selected === d || hover === d || w > 160) box(ctx, cx, ye, (long ? 'Achat ' : 'Vente ') + px(d.e) + ' F · Qté ' + tidy(nf0.format(qty)) + ' · Gain/risque ' + tidy(nf2.format(rr)) + ' · Latent ' + pc(cur), '#182133', '#F3F6FB', 'center');
        },
        move: function (d, dl, dp) { d.l1 += dl; d.l2 += dl; d.e += dp; d.tp += dp; d.sl += dp; },
        set: function (d, k, l, p) {
          if (k === 'w') { d.l2 = Math.max(d.l1 + 2, l); return; }
          if (k === 'e') { // l'entrée reste entre l'objectif et le stop
            var lo = Math.min(d.tp, d.sl), hi = Math.max(d.tp, d.sl);
            d.e = Math.min(hi * 0.9995, Math.max(lo * 1.0005, p)); d.l1 = Math.min(l, d.l2 - 2); return;
          }
          var long = d.type === 'long';
          if (k === 'tp') d.tp = long ? Math.max(p, d.e * 1.0005) : Math.min(p, d.e * 0.9995);
          if (k === 'sl') d.sl = long ? Math.min(p, d.e * 0.9995) : Math.max(p, d.e * 1.0005);
        }
      }
    };
    function T_rectHit(d, x, y) { return T.rect.hit(d, x, y); }
    T.long = T.position; T.short = T.position;

    function endPrice(x, y, other, p, c) { // petit prix collé à l'extrémité d'une ligne
      ctx.font = FONT; ctx.fillStyle = c; ctx.textBaseline = 'middle';
      ctx.textAlign = other < x ? 'left' : 'right';
      ctx.fillText(px(p), x + (other < x ? 8 : -8), y - 10);
    }
    function line(x1, y1, x2, y2, c, w) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
    function dashed(x1, y1, x2, y2, c) { ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.setLineDash([]); }
    function arrow(x1, y1, x2, y2, c) {
      line(x1, y1, x2, y2, c, 1.5);
      var a = Math.atan2(y2 - y1, x2 - x1);
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - 8 * Math.cos(a - 0.4), y2 - 8 * Math.sin(a - 0.4)); ctx.lineTo(x2 - 8 * Math.cos(a + 0.4), y2 - 8 * Math.sin(a + 0.4)); ctx.fill();
    }
    var moveGeneric = function (d, dl, dp) { ['a', 'b'].forEach(function (k) { if (d[k]) { d[k].l += dl; d[k].p += dp; } }); };
    var setGeneric = function (d, k, l, p) { d[k].l = l; d[k].p = p; };

    // ───────── Rendu ─────────
    var raf = 0;
    function redraw() { if (!raf) raf = requestAnimationFrame(function () { raf = 0; requestAnimationFrame(paint); }); }
    function paint() {
      var w = ts().width(), fw = host.clientWidth, h = host.clientHeight - ts().height(), dpr = window.devicePixelRatio || 1;
      W = w;
      if (fw !== FW || h !== H || canvas.width !== Math.round(fw * dpr)) {
        FW = fw; H = h;
        canvas.width = Math.round(fw * dpr); canvas.height = Math.round(h * dpr);
        canvas.style.width = fw + 'px'; canvas.style.height = h + 'px';
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, FW, H);
      G = geo();
      if (!G || !visible) { syncBox(); return; }
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
      drawings.forEach(function (d) { try { T[d.type].draw(d); } catch (e) {} });
      if (pending && pending.preview) { try { T[pending.preview.type].draw(pending.preview); } catch (e) {} }
      var sel = selected && drawings.indexOf(selected) >= 0 ? selected : null;
      if (sel) T[sel.type].handles(sel).forEach(function (hd) {
        ctx.fillStyle = '#0D1422'; ctx.strokeStyle = '#4C9BFF'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(hd[1], hd[2], 5.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });
      ctx.restore();
      // Prix exacts sur l'échelle de droite, comme sur TradingView
      var tags = [];
      drawings.forEach(function (d) { if (d.type === 'hline' || d.type === 'label') tags.push([d.a.p, d.color]); });
      var focus = drag ? drag.d : sel || hover;
      if (focus && focus.type !== 'hline' && focus.type !== 'label') axisPrices(focus).forEach(function (t) { tags.push(t); });
      // Avant de cliquer : point et prix exacts où le tracé sera posé
      if (cur && tool !== 'cross' && !drag && G) {
        var sp = tool === 'brush' || tool === 'text' ? { l: L(cur.x), p: P(cur.y) } : snap(L(cur.x), P(cur.y), cur.y);
        if (sp.p != null) {
          var cx0 = tool === 'brush' || tool === 'text' ? cur.x : X(sp.l), cy0 = Y(sp.p);
          ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
          ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.fillStyle = '#0D1422';
          ctx.beginPath(); ctx.arc(cx0, cy0, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
          box(ctx, cx0 + 10, cy0 - 14, px(sp.p) + ' F', color, ink(color), 'left');
          ctx.restore();
          tags.push([sp.p, color]);
        }
      }
      tags.forEach(function (t) {
        var y = Y(t[0]);
        if (!isFinite(y) || y < 0 || y > H) return;
        ctx.font = FONT; ctx.fillStyle = t[1];
        ctx.fillRect(W + 1, y - 9, FW - W - 1, 18);
        ctx.fillStyle = ink(t[1]); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(px(t[0]), W + 6, y + 0.5);
      });
      syncBox();
    }
    function axisPrices(d) {
      switch (d.type) {
        case 'trend': case 'rect': case 'measure': return [[d.a.p, d.color], [d.b.p, d.color]];
        case 'fib': return FIB.map(function (f) { return [d.b.p + (d.a.p - d.b.p) * f[0], f[1]]; });
        case 'label': case 'text': return [[d.a.p, d.color]];
        case 'long': case 'short': return [[d.tp, '#0E9A62'], [d.e, '#4C9BFF'], [d.sl, '#D63C55']];
        default: return [];
      }
    }

    // Aimant : accroche le point au cours d'ouverture ou de clôture de la séance la plus proche
    function snap(l, p, y) {
      if (!magnet) return { l: l, p: p };
      var i = Math.round(l);
      if (i < 0 || i > lastIdx) return { l: i, p: Math.abs(p) >= 100 ? Math.round(p) : Math.round(p * 100) / 100 };
      var bar = pts[i], best = null, dist = Infinity, cand = [bar.c];
      var st = getSeries().seriesType ? getSeries().seriesType() : '';
      if (st === 'Candlestick') cand.push(bar.o > 0 ? bar.o : (i ? pts[i - 1].c : bar.c));
      cand.forEach(function (v) { if (v > 0) { var dd = Math.abs(Y(v) - y); if (dd < dist) { dist = dd; best = v; } } });
      if (best != null && dist < 12) return { l: i, p: best };
      return { l: i, p: Math.abs(p) >= 100 ? Math.round(p) : Math.round(p * 100) / 100 };
    }

    // ───────── Souris et doigt ─────────
    var pos = function (e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    var inPane = function (q) { return q.x >= 0 && q.x <= W && q.y >= 0 && q.y <= H; };
    function pick(q) {
      if (!visible) return null;
      if (selected) {
        var hs = T[selected.type].handles(selected);
        for (var i = 0; i < hs.length; i++) if (Math.hypot(q.x - hs[i][1], q.y - hs[i][2]) < 10) return { d: selected, handle: hs[i][0] };
      }
      for (var j = drawings.length - 1; j >= 0; j--) if (T[drawings[j].type].hit(drawings[j], q.x, q.y)) return { d: drawings[j], handle: null };
      return null;
    }
    function make(type, l, p) {
      var d = { type: type, color: color, w: width };
      if (type === 'brush') { d.pts = [{ l: l, p: p }]; return d; }
      if (type === 'long' || type === 'short') {
        var span = Math.abs(P(0) - P(H)) / 10 || p * 0.03;
        d.l1 = l; d.l2 = l + Math.max(8, 120 / Math.max(G.s, 0.5)); d.e = p;
        var rp = function (v) { return Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 100) / 100; };
        d.tp = rp(type === 'long' ? p + span : p - span); d.sl = rp(type === 'long' ? p - span : p + span);
        return d;
      }
      d.a = { l: l, p: p }; d.b = { l: l, p: p };
      return d;
    }
    function finish(d) {
      snapshot();
      d.id = seq++;
      drawings.push(d);
      selected = d;
      pending = null;
      if (o.onToolDone) o.onToolDone();
      save(); redraw();
    }
    function openEditor(d, q) {
      editing = d;
      editor.hidden = false;
      editor.value = d.text || '';
      editor.style.left = Math.max(0, Math.min(q.x, W - 200)) + 'px';
      editor.style.top = Math.max(0, q.y - 30) + 'px';
      editor.style.color = d.color;
      setTimeout(function () { editor.focus(); editor.select(); }, 0);
    }
    function closeEditor(commit) {
      if (!editing) return;
      var d = editing, v = editor.value.trim();
      editing = null; editor.hidden = true;
      if (commit && v) {
        if (drawings.indexOf(d) < 0) { d.text = v; finish(d); } else { snapshot(); d.text = v; save(); }
      }
      redraw();
    }
    editor.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); closeEditor(true); }
      if (e.key === 'Escape') { e.preventDefault(); closeEditor(false); }
      e.stopPropagation();
    });
    editor.addEventListener('blur', function () { closeEditor(true); });

    // ───────── Boîte de la position longue : capital, entrée, objectif, stop ─────────
    var pbox = document.createElement('div');
    pbox.className = 'cx-posbox'; pbox.hidden = true;
    pbox.setAttribute('role', 'dialog'); pbox.setAttribute('aria-label', 'Position longue');
    pbox.innerHTML = '<p class="cx-posbox-t">Position longue</p>' +
      '<label>Capital simulé<span><input type="number" min="1000" step="1000" data-k="cap"> F</span></label>' +
      '<label>Prix d’achat<span><input type="number" min="0" step="any" data-k="e"> F</span></label>' +
      '<label>Objectif<span><input type="number" min="0" step="any" data-k="tp"> F</span></label>' +
      '<label>Stop<span><input type="number" min="0" step="any" data-k="sl"> F</span></label>';
    host.appendChild(pbox);
    var inBox = function (e) { return e.target && e.target.closest && e.target.closest('.cx-posbox, .cx-text-edit') && !drag; };
    var boxFor = null;
    function syncBox() {
      var d = selected && drawings.indexOf(selected) >= 0 && (selected.type === 'long' || selected.type === 'short') && visible && !drag ? selected : null;
      if (!d || !G) { pbox.hidden = true; boxFor = null; return; }
      pbox.hidden = false;
      var act = document.activeElement && pbox.contains(document.activeElement);
      if (boxFor !== d || !act) {
        pbox.querySelector('[data-k="cap"]').value = capital;
        ['e', 'tp', 'sl'].forEach(function (k) { pbox.querySelector('[data-k="' + k + '"]').value = d[k]; });
        boxFor = d;
      }
      var bw = pbox.offsetWidth || 200, bh = pbox.offsetHeight || 170;
      var xl = Math.min(X(d.l1), X(d.l2)), xr = Math.max(X(d.l1), X(d.l2));
      var top = Math.min(Y(d.tp), Y(d.sl)), bot = Math.max(Y(d.tp), Y(d.sl));
      var left = xr + 12 + bw <= W ? xr + 12 : xl - 12 - bw >= 0 ? xl - 12 - bw : Math.max(0, Math.min(W - bw, (xl + xr) / 2 - bw / 2));
      var ty = left >= xr || left + bw <= xl ? (top + bot) / 2 - bh / 2 : (top - bh - 28 >= 0 ? top - bh - 28 : bot + 28);
      pbox.style.left = Math.round(left) + 'px';
      pbox.style.top = Math.round(Math.max(0, Math.min(H - bh, ty))) + 'px';
    }
    pbox.addEventListener('change', function (e) {
      var k = e.target.getAttribute('data-k'), v = +e.target.value, d = boxFor;
      if (!d || !k) return;
      if (k === 'cap') { if (v >= 1000) { capital = Math.round(v); save(); } boxFor = null; redraw(); return; }
      var n = { e: d.e, tp: d.tp, sl: d.sl }; n[k] = v;
      var ok = v > 0 && (d.type === 'long' ? n.sl < n.e && n.e < n.tp : n.tp < n.e && n.e < n.sl);
      if (ok) { snapshot(); d[k] = v; save(); }
      boxFor = null; redraw();
    });
    pbox.addEventListener('keydown', function (e) { if (e.key === 'Enter') e.target.blur(); e.stopPropagation(); });
    ['pointerdown', 'mousedown', 'touchstart', 'wheel', 'dblclick'].forEach(function (t) { pbox.addEventListener(t, function (e) { e.stopPropagation(); }); });

    var swallow = false;
    function down(e) {
      if (inBox(e)) return;
      if (e.button != null && e.button !== 0) return;
      var q = pos(e);
      if (!inPane(q) || !G) return;
      G = geo();
      var l = L(q.x), p = P(q.y);
      if (p == null) return;
      if (tool !== 'cross' && tool !== 'brush' && tool !== 'text') { var sn = snap(l, p, q.y); l = sn.l; p = sn.p; }
      if (editing) closeEditor(true);
      if (tool !== 'cross') {
        swallow = true; e.preventDefault(); e.stopPropagation();
        if (pending && pending.second) { // deuxième clic
          setGeneric(pending.preview, 'b', l, p); finish(pending.preview); return;
        }
        if (tool === 'text') { openEditor(make('text', l, p), q); return; }
        var d = make(tool, l, p);
        if (ONE_CLICK[tool]) { finish(d); return; }
        pending = { preview: d, start: q, second: false };
        drag = { kind: 'create', d: d };
        try { host.setPointerCapture(e.pointerId); } catch (er) {}
        return;
      }
      var hit = pick(q);
      if (hit) {
        swallow = true; e.preventDefault(); e.stopPropagation();
        selected = hit.d;
        snapshot();
        drag = { kind: hit.handle ? 'handle' : 'move', d: hit.d, handle: hit.handle, l: l, p: p, moved: false };
        try { host.setPointerCapture(e.pointerId); } catch (er) {}
        if (o.onChange) o.onChange({ count: drawings.length, selected: selected });
        redraw();
      } else if (selected) { selected = null; if (o.onChange) o.onChange({ count: drawings.length, selected: null }); redraw(); }
    }
    function move(e) {
      if (inBox(e)) return;
      var q = pos(e);
      cur = inPane(q) ? q : null;
      if (tool !== 'cross' && !drag) redraw();
      if (!G) G = geo();
      if (!G) return;
      var l = L(q.x), p = P(q.y);
      if (drag) {
        e.preventDefault(); e.stopPropagation();
        if (p == null) return;
        var d = drag.d;
        if (drag.kind !== 'move' && d.type !== 'brush') { var sn = snap(l, p, q.y); l = sn.l; p = sn.p; }
        if (drag.kind === 'create') {
          if (d.type === 'brush') d.pts.push({ l: l, p: p }); else setGeneric(d, 'b', l, p);
        } else if (drag.kind === 'move') {
          var mv = T[d.type].move || moveGeneric;
          var dl = magnet && d.type !== 'brush' ? Math.round(l - drag.l) : l - drag.l;
          mv(d, dl, p - drag.p); drag.l += dl; drag.p = p; drag.moved = true;
        } else {
          (T[d.type].set || setGeneric)(d, drag.handle, l, p); drag.moved = true;
        }
        redraw();
        return;
      }
      if (pending && pending.second) { var s2 = snap(l, p, q.y); setGeneric(pending.preview, 'b', s2.l, s2.p); redraw(); return; }
      if (tool === 'cross') {
        var hit = inPane(q) ? pick(q) : null;
        var nh = hit ? hit.d : null;
        host.style.cursor = hit ? (hit.handle ? 'grab' : 'move') : '';
        if (nh !== hover) { hover = nh; redraw(); }
      }
    }
    function up(e) {
      if (!drag) return;
      e.stopPropagation();
      var d = drag.d, kind = drag.kind, moved = drag.moved;
      drag = null;
      try { host.releasePointerCapture(e.pointerId); } catch (er) {}
      if (kind === 'create') {
        var q = pos(e);
        if (d.type === 'brush') { if (d.pts.length > 1) finish(d); else pending = null; return; }
        if (Math.hypot(q.x - pending.start.x, q.y - pending.start.y) < 6) { pending.second = true; return; } // clic-clic
        finish(d);
        return;
      }
      if (moved) save(); else undo.pop();
      redraw();
    }
    function dbl(e) {
      if (inBox(e)) return;
      var q = pos(e), hit = pick(q);
      if (hit && hit.d.type === 'text') { e.preventDefault(); e.stopPropagation(); openEditor(hit.d, q); }
    }
    // Phase de capture : le tracé passe avant le défilement du graphique
    host.addEventListener('pointerdown', down, true);
    host.addEventListener('pointermove', move, true);
    host.addEventListener('pointerup', up, true);
    host.addEventListener('pointercancel', up, true);
    host.addEventListener('dblclick', dbl, true);
    ['mousedown', 'touchstart', 'mousemove', 'touchmove', 'wheel'].forEach(function (t) {
      host.addEventListener(t, function (e) {
        if (inBox(e)) return;
        if (swallow || drag || (tool !== 'cross' && t !== 'wheel' && t !== 'mousemove')) { e.stopPropagation(); if (t === 'touchmove' || t === 'touchstart') e.preventDefault(); }
        if (t === 'mousedown' || t === 'touchstart') setTimeout(function () { swallow = false; }, 0);
      }, { capture: true, passive: false });
    });
    host.addEventListener('mouseleave', function () { cur = null; if (hover) hover = null; redraw(); });
    function onKey(e) {
      var tag = (e.target && e.target.tagName) || '';
      if (/INPUT|TEXTAREA|SELECT/.test(tag)) return;
      if (!host.isConnected) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); api.remove(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); api.undo(); }
      else if (e.key === 'Escape') { pending = null; api.setTool('cross'); if (o.onToolDone) o.onToolDone(); }
    }
    document.addEventListener('keydown', onKey);

    chart.timeScale().subscribeVisibleLogicalRangeChange(redraw);
    chart.subscribeCrosshairMove(redraw);
    var ro = window.ResizeObserver ? new ResizeObserver(redraw) : null;
    if (ro) ro.observe(host);
    redraw();

    var api = {
      COLORS: COLORS,
      setTool: function (t) {
        tool = t; pending = null; if (editing) closeEditor(false);
        host.classList.toggle('is-drawing', t !== 'cross');
        host.style.cursor = t === 'cross' ? '' : t === 'text' ? 'text' : 'crosshair';
        redraw();
      },
      setColor: function (c) { color = c; if (selected) { snapshot(); selected.color = c; save(); } redraw(); },
      setWidth: function (w) { width = w; if (selected) { snapshot(); selected.w = w; save(); } redraw(); },
      setMagnet: function (m) { magnet = m; },
      setCapital: function (v) { if (v > 0) { capital = v; save(); redraw(); } },
      capital: function () { return capital; },
      remove: function () { if (!selected) return; snapshot(); drawings = drawings.filter(function (d) { return d !== selected; }); selected = null; save(); redraw(); },
      clear: function () { if (!drawings.length) return; snapshot(); drawings = []; selected = null; save(); redraw(); },
      undo: function () { if (!undo.length) return; drawings = JSON.parse(undo.pop()); drawings.forEach(function (d) { d.id = seq++; }); selected = null; save(); redraw(); },
      toggle: function () { visible = !visible; canvas.style.visibility = visible ? '' : 'hidden'; redraw(); return visible; },
      redraw: redraw,
      count: function () { return drawings.length; },
      destroy: function () { document.removeEventListener('keydown', onKey); if (ro) ro.disconnect(); canvas.remove(); editor.remove(); pbox.remove(); }
    };
    return api;
  }

  window.BxDraw = { create: create, COLORS: COLORS };
})();
