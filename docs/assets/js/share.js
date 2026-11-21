/* BRVMexa — partage d'une actualité ou du Mag : WhatsApp, Facebook, X, LinkedIn, Instagram, copie du lien,
   et une image « story » 1080×1920 aux couleurs de BRVMexa, créée dans le navigateur (aucun envoi à un serveur).
   Tout bouton [data-bx-share] ouvre le panneau : data-share-url, data-share-title, data-share-text,
   data-share-kind (ex. « Actualité »), data-share-cover (image du même site, facultative). */
(function () {
  'use strict';
  var SITE = 'https://www.brvmexa.com';

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var enc = encodeURIComponent;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ───── Icônes ─────
  var I = {
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
    whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="o" d="M3.6 20.4l1.2-4.1A8.6 8.6 0 1 1 8 19.2z"/><path class="f" d="M9.1 7.6c.3-.1.6 0 .7.3l.7 1.6c.1.3 0 .5-.2.7l-.5.6c.6 1.3 1.6 2.3 2.9 2.9l.6-.5c.2-.2.5-.3.7-.2l1.6.7c.3.1.4.4.3.7-.3 1-1.1 1.6-2.1 1.5-3.3-.4-5.8-2.9-6.2-6.2-.1-1 .5-1.8 1.5-2.1z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="f" d="M13.4 21v-7.6h2.6l.4-3h-3V8.5c0-.9.3-1.5 1.5-1.5h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.7v3h2.6V21z"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="f" d="M17.8 3h3l-6.6 7.6L22 21h-6.1l-4.8-6.3L5.6 21h-3l7.1-8.1L2.2 3h6.2l4.3 5.7zm-1 16.2h1.7L7.3 4.7H5.5z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="f" d="M6.9 8.8H3.8V20h3.1zM5.3 3.8a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6zM20.2 13.6c0-3-1.6-5-4.3-5-1.3 0-2.3.6-2.8 1.4V8.8h-3V20h3.1v-5.6c0-1.5.6-2.6 2-2.6s1.9 1 1.9 2.6V20h3.1z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect class="o" x="3" y="3" width="18" height="18" rx="5.2"/><circle class="o" cx="12" cy="12" r="4.1"/><circle class="f" cx="17.4" cy="6.6" r="1.2"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect class="o" x="8.5" y="8.5" width="12" height="12" rx="2.6"/><path class="o" d="M15.5 8.5V6.1A2.6 2.6 0 0 0 12.9 3.5H6.1A2.6 2.6 0 0 0 3.5 6.1v6.8a2.6 2.6 0 0 0 2.6 2.6h2.4"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="o" d="m5 12.5 4.4 4.4L19 7.3"/></svg>',
    spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="f" d="M12 2.5l1.9 5.6 5.6 1.9-5.6 1.9L12 17.5l-1.9-5.6-5.6-1.9 5.6-1.9zM19 15l.9 2.6 2.6.9-2.6.9L19 22l-.9-2.6-2.6-.9 2.6-.9z"/></svg>',
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="o" d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 13v5.5A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V13"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="o" d="M6 6l12 12M18 6 6 18"/></svg>'
  };
  window.BxShareIcon = I.share;

  // ───── Petit message en bas de l'écran ─────
  var toastEl = null, toastT = 0;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'sh-toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.innerHTML = I.check + '<span>' + esc(msg) + '</span>';
    toastEl.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2600);
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (ok, ko) {
      var t = document.createElement('textarea');
      t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select();
      try { document.execCommand('copy') ? ok() : ko(); } catch (e) { ko(e); }
      t.remove();
    });
  }

  // ───── Image « story » 1080×1920 ─────
  function loadImg(src) {
    return new Promise(function (ok) {
      if (!src) return ok(null);
      var u; try { u = new URL(src, location.href); } catch (e) { return ok(null); }
      if (u.origin !== location.origin) return ok(null); // seulement nos images (sinon le dessin serait bloqué)
      var im = new Image(); im.onload = function () { ok(im); }; im.onerror = function () { ok(null); }; im.src = u.href;
    });
  }
  function wrap(ctx, text, maxW, maxLines) {
    var words = String(text || '').split(/\s+/), lines = [], line = '';
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = words[i]; } else line = test;
      if (lines.length === maxLines) break;
    }
    if (lines.length < maxLines && line) lines.push(line);
    var used = lines.join(' ').split(/\s+/).length;
    if (used < words.length && lines.length) {
      var last = lines[lines.length - 1];
      while (ctx.measureText(last + '…').width > maxW && last.indexOf(' ') > 0) last = last.slice(0, last.lastIndexOf(' '));
      lines[lines.length - 1] = last.replace(/[,;:.\s]+$/, '') + '…';
    }
    return lines;
  }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function logo(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 32, s / 32);
    ctx.fillStyle = '#16C47F'; rrect(ctx, 0, 0, 32, 32, 8); ctx.fill();
    ctx.fillStyle = '#0A0F1A';
    rrect(ctx, 7, 17, 4, 8, 1.5); ctx.fill(); rrect(ctx, 14, 12, 4, 13, 1.5); ctx.fill(); rrect(ctx, 21, 7, 4, 18, 1.5); ctx.fill();
    ctx.strokeStyle = '#0A0F1A'; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(6, 14); ctx.lineTo(13, 9); ctx.lineTo(18, 11); ctx.lineTo(26, 5); ctx.stroke();
    ctx.restore();
  }
  function storyImage(d) {
    var W = 1080, H = 1920, P = 96;
    var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var ctx = cv.getContext('2d');
    var font = (getComputedStyle(document.body).fontFamily || 'Inter, Arial, sans-serif');
    var ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    return ready.then(function () { return loadImg(d.cover); }).then(function (cover) {
      // Fond : nuit profonde, halos vert et or, grille de cotation discrète
      ctx.fillStyle = '#0A0F1A'; ctx.fillRect(0, 0, W, H);
      var g1 = ctx.createRadialGradient(W * 0.9, 120, 0, W * 0.9, 120, 900);
      g1.addColorStop(0, 'rgba(22,196,127,.42)'); g1.addColorStop(1, 'rgba(22,196,127,0)');
      ctx.fillStyle = g1; ctx.fillRect(0, 0, W, H);
      var g2 = ctx.createRadialGradient(0, H - 200, 0, 0, H - 200, 900);
      g2.addColorStop(0, 'rgba(242,179,61,.22)'); g2.addColorStop(1, 'rgba(242,179,61,0)');
      ctx.fillStyle = g2; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(255,255,255,.045)'; ctx.lineWidth = 2;
      for (var gx = 0; gx <= W; gx += 108) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
      for (var gy = 0; gy <= H; gy += 108) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
      // Courbe de bourse stylisée
      ctx.save(); ctx.strokeStyle = 'rgba(22,196,127,.55)'; ctx.lineWidth = 6; ctx.lineJoin = 'round'; ctx.beginPath();
      var pts = [0, 1560, 140, 1500, 260, 1530, 380, 1420, 520, 1450, 640, 1330, 780, 1360, 900, 1220, 1080, 1180];
      ctx.moveTo(pts[0], pts[1]); for (var i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]); ctx.stroke();
      ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
      var gf = ctx.createLinearGradient(0, 1180, 0, H); gf.addColorStop(0, 'rgba(22,196,127,.16)'); gf.addColorStop(1, 'rgba(22,196,127,0)');
      ctx.fillStyle = gf; ctx.fill(); ctx.restore();

      // En-tête : logo + BRVMexa
      logo(ctx, P, 120, 92);
      ctx.fillStyle = '#F3F6FB'; ctx.font = '800 54px ' + font; ctx.textBaseline = 'middle';
      ctx.fillText('BRVMexa', P + 120, 166);
      ctx.fillStyle = '#A3AEC2'; ctx.font = '500 30px ' + font; ctx.textAlign = 'right';
      ctx.fillText('La Bourse régionale, simplement', W - P, 166); ctx.textAlign = 'left';

      var y = 330;
      // Couverture du Mag (si fournie)
      if (cover) {
        var cw = 520, ch = Math.round(cw * cover.height / cover.width), cx = (W - cw) / 2;
        ctx.save(); ctx.translate(W / 2, y + ch / 2); ctx.rotate(-0.035); ctx.translate(-W / 2, -(y + ch / 2));
        ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 60; ctx.shadowOffsetY = 30;
        rrect(ctx, cx, y, cw, ch, 18); ctx.fillStyle = '#111827'; ctx.fill();
        ctx.shadowColor = 'transparent'; ctx.save(); rrect(ctx, cx, y, cw, ch, 18); ctx.clip(); ctx.drawImage(cover, cx, y, cw, ch); ctx.restore();
        ctx.restore();
        y += ch + 90;
      } else y = 560;

      // Étiquette
      var kick = String(d.kind || 'Actualité').toUpperCase();
      ctx.font = '800 30px ' + font; var kw = ctx.measureText(kick).width + 56;
      rrect(ctx, P, y, kw, 62, 31); ctx.fillStyle = cover ? '#F2B33D' : '#16C47F'; ctx.fill();
      ctx.fillStyle = '#0A0F1A'; ctx.fillText(kick, P + 28, y + 32);
      y += 120;

      // Titre
      var tSize = cover ? 64 : 78;
      ctx.font = '800 ' + tSize + 'px ' + font; ctx.fillStyle = '#F3F6FB'; ctx.textBaseline = 'alphabetic';
      var head = cover ? String(d.title || '').replace(/^.*?:\s/, '') : d.title; // le Mag : l'étiquette donne déjà le numéro
      var tl = wrap(ctx, head, W - 2 * P, cover ? 3 : 6);
      tl.forEach(function (l) { y += tSize * 1.16; ctx.fillText(l, P, y); });
      // Résumé
      if (d.text) {
        y += 50; ctx.font = '500 40px ' + font; ctx.fillStyle = '#A3AEC2';
        wrap(ctx, d.text, W - 2 * P, cover ? 2 : 4).forEach(function (l) { y += 56; ctx.fillText(l, P, y); });
      }

      // Pied : appel à l'action
      var by = H - 250;
      rrect(ctx, P, by, W - 2 * P, 128, 64); ctx.fillStyle = '#F3F6FB'; ctx.fill();
      ctx.fillStyle = '#0A0F1A'; ctx.font = '800 40px ' + font; ctx.textBaseline = 'middle'; ctx.textAlign = 'center';
      ctx.fillText(cover ? 'Téléchargez-le gratuitement' : 'Lire l’article en entier', W / 2, by + 50);
      ctx.font = '600 30px ' + font; ctx.fillStyle = '#0E9F67';
      var shortUrl = String(d.url || SITE).replace(/^https?:\/\//, '').replace(/#.*$/, '').replace(/\/$/, '');
      ctx.fillText(shortUrl, W / 2, by + 92);
      ctx.textAlign = 'left';
      return new Promise(function (ok) { cv.toBlob(function (b) { ok(b); }, 'image/png'); });
    });
  }

  // ───── Panneau de partage ─────
  var sheet = null, lastFocus = null;
  function close() {
    if (!sheet) return;
    var s = sheet; sheet = null;
    s.classList.remove('is-open');
    document.documentElement.classList.remove('sh-lock');
    setTimeout(function () { s.remove(); }, reduce ? 0 : 280);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function popup(url) {
    var w = 620, h = 640, l = Math.max(0, (screen.width - w) / 2), t = Math.max(0, (screen.height - h) / 2);
    var win = window.open(url, '_blank', 'noopener,noreferrer,width=' + w + ',height=' + h + ',left=' + l + ',top=' + t);
    if (!win) location.href = url;
  }

  function open(d) {
    close();
    lastFocus = document.activeElement;
    var url = d.url || location.href, title = d.title || document.title;
    var msg = title + (d.via === false ? '' : ' — via BRVMexa');
    var host = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    var nets = [
      ['whatsapp', 'WhatsApp', 'https://wa.me/?text=' + enc(msg + '\n' + url)],
      ['facebook', 'Facebook', 'https://www.facebook.com/sharer/sharer.php?u=' + enc(url)],
      ['x', 'X', 'https://x.com/intent/post?text=' + enc(msg) + '&url=' + enc(url)],
      ['linkedin', 'LinkedIn', 'https://www.linkedin.com/sharing/share-offsite/?url=' + enc(url)],
      ['instagram', 'Instagram', ''],
      ['copy', 'Copier le lien', '']
    ];
    var canNative = !!navigator.share && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    sheet = document.createElement('div');
    sheet.className = 'sh-wrap';
    sheet.innerHTML =
      '<div class="sh-back" data-sh-close></div>' +
      '<div class="sh" role="dialog" aria-modal="true" aria-labelledby="sh-t" tabindex="-1">' +
        '<span class="sh-grab" aria-hidden="true"></span>' +
        '<div class="sh-head"><p id="sh-t" class="sh-title">' + I.share + '<span>Partager</span></p>' +
          '<button type="button" class="sh-x" data-sh-close aria-label="Fermer">' + I.close + '</button></div>' +
        '<div class="sh-card">' +
          (d.cover ? '<img src="' + esc(d.cover) + '" alt="" width="60" height="85">' : '<span class="sh-mark" aria-hidden="true"></span>') +
          '<div><small>' + esc(d.kind || 'Actualité') + ' · ' + esc(host) + '</small><b>' + esc(title) + '</b></div></div>' +
        '<div class="sh-grid">' + nets.map(function (n, i) {
          return '<button type="button" class="sh-net sh-n-' + n[0] + '" data-net="' + n[0] + '" style="--i:' + i + '">' +
            '<span class="sh-ico">' + I[n[0]] + '</span><span class="sh-lab">' + esc(n[1]) + '</span></button>';
        }).join('') + '</div>' +
        '<div class="sh-link"><input type="text" readonly value="' + esc(url) + '" aria-label="Lien à partager">' +
          '<button type="button" data-net="copy">' + I.copy + '<span>Copier</span></button></div>' +
        '<button type="button" class="sh-story" data-sh-story><span class="sh-story-ico">' + I.spark + '</span>' +
          '<span><b>Créer une image à partager</b><small>Format story pour Instagram et le statut WhatsApp</small></span></button>' +
        (canNative ? '<button type="button" class="sh-more" data-sh-native>' + I.more + '<span>Plus d’applications…</span></button>' : '') +
      '</div>';
    document.body.appendChild(sheet);
    document.documentElement.classList.add('sh-lock');
    var box = sheet.querySelector('.sh');
    requestAnimationFrame(function () { if (sheet) sheet.classList.add('is-open'); });
    box.focus();

    var input = sheet.querySelector('.sh-link input');
    input.addEventListener('focus', function () { input.select(); });

    function copied(btn) {
      return copyText(url).then(function () {
        toast('Lien copié');
        if (btn) { btn.classList.add('is-done'); setTimeout(function () { btn.classList.remove('is-done'); }, 1800); }
      }, function () { input.focus(); input.select(); toast('Sélectionnez le lien puis copiez-le'); });
    }
    function story(forInstagram) {
      var btn = sheet && sheet.querySelector('[data-sh-story]');
      if (btn) btn.classList.add('is-busy');
      return storyImage(d).then(function (blob) {
        if (btn) btn.classList.remove('is-busy');
        if (!blob) throw new Error('image');
        var name = 'brvmexa-' + (d.slug || 'partage') + '.png';
        var file = null;
        try { file = new File([blob], name, { type: 'image/png' }); } catch (e) { file = null; }
        if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
          copyText(url).catch(function () {});
          return navigator.share({ files: [file], title: title, text: msg + '\n' + url }).catch(function () {});
        }
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
        copyText(url).catch(function () {});
        toast(forInstagram ? 'Image téléchargée et lien copié : publiez-la sur Instagram' : 'Image téléchargée et lien copié');
      }).catch(function () { if (btn) btn.classList.remove('is-busy'); toast('L’image n’a pas pu être créée'); });
    }

    sheet.addEventListener('click', function (e) {
      if (e.target.closest('[data-sh-close]')) return close();
      if (e.target.closest('[data-sh-story]')) return story(false);
      if (e.target.closest('[data-sh-native]')) { navigator.share({ title: title, text: msg, url: url }).catch(function () {}); return; }
      var b = e.target.closest('[data-net]');
      if (!b) return;
      var net = b.getAttribute('data-net');
      if (net === 'copy') return copied(b);
      if (net === 'instagram') return story(true);
      var n = nets.filter(function (x) { return x[0] === net; })[0];
      if (n) popup(n[2]);
    });
    sheet.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      if (e.key === 'Tab') { // garde le clavier dans le panneau
        var f = [].slice.call(box.querySelectorAll('button, input')), first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    // Glisser vers le bas pour fermer (téléphone)
    var y0 = null;
    box.addEventListener('touchstart', function (e) { if (box.scrollTop <= 0) y0 = e.touches[0].clientY; }, { passive: true });
    box.addEventListener('touchmove', function (e) {
      if (y0 == null) return; var dy = e.touches[0].clientY - y0;
      if (dy > 0) box.style.transform = 'translateY(' + dy + 'px)';
    }, { passive: true });
    box.addEventListener('touchend', function (e) {
      if (y0 == null) return; var dy = e.changedTouches[0].clientY - y0; y0 = null; box.style.transform = '';
      if (dy > 110) close();
    });
  }

  // Bouton de partage (petite pastille ronde), à insérer dans une carte
  function button(d, extraClass) {
    return '<button type="button" class="sh-btn' + (extraClass ? ' ' + extraClass : '') + '" data-bx-share' +
      ' data-share-url="' + esc(d.url) + '" data-share-title="' + esc(d.title) + '"' +
      (d.text ? ' data-share-text="' + esc(d.text) + '"' : '') +
      (d.kind ? ' data-share-kind="' + esc(d.kind) + '"' : '') +
      (d.cover ? ' data-share-cover="' + esc(d.cover) + '"' : '') +
      (d.slug ? ' data-share-slug="' + esc(d.slug) + '"' : '') +
      ' aria-label="Partager : ' + esc(d.title) + '" title="Partager">' + I.share + '</button>';
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-bx-share]');
    if (!b) return;
    e.preventDefault(); e.stopPropagation();
    open({
      url: b.getAttribute('data-share-url'), title: b.getAttribute('data-share-title'),
      text: b.getAttribute('data-share-text'), kind: b.getAttribute('data-share-kind'),
      cover: b.getAttribute('data-share-cover'), slug: b.getAttribute('data-share-slug')
    });
  }, true);

  window.BxShare = { open: open, button: button, close: close };

  // Page d'article pas encore publiée (lien partagé il y a moins de 15 minutes) : on ouvre l'article sur la page Actualités
  if (document.body && document.body.classList.contains('page-404')) {
    var m = /^\/actualites\/a\/([a-z0-9-]{3,64})\/?$/.exec(location.pathname);
    var u = /^\/actualites\/une\/\d{4}-\d{2}-\d{2}\/?$/.test(location.pathname);
    if (m) location.replace('/actualites/#' + m[1]); else if (u) location.replace('/actualites/#a-la-une');
  }
})();
