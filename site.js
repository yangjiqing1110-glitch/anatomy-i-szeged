/* Anatomy I — Exam Answers · site behaviour */
(function () {
  "use strict";

  var script = document.currentScript;
  var ROOT = (script && script.dataset.root) || "";
  var ED = (script && script.dataset.ed) || "condensed";
  var VER = (script && script.dataset.ver) || "";
  var isHome = /(?:index\.html)?$/.test(location.pathname) && !/\/[a-z]+\/part-/.test(location.pathname) &&
               (location.pathname.replace(/[^/]*$/, "") === "/" || /index\.html$/.test(location.pathname));

  /* wrap wide tables so they scroll horizontally on phones */
  Array.prototype.forEach.call(document.querySelectorAll("table.tbl"), function (t) {
    if (t.parentElement && t.parentElement.classList.contains("tw")) return;
    var w = document.createElement("div");
    w.className = "tw";
    t.parentNode.insertBefore(w, t);
    w.appendChild(t);
  });

  /* ---------------- theme ---------------- */
  var THEME_KEY = "anat_theme";
  function applyTheme(t) {
    if (t) document.documentElement.setAttribute("data-theme", t);
    else document.documentElement.removeAttribute("data-theme");
  }
  try { applyTheme(localStorage.getItem(THEME_KEY)); } catch (e) {}
  function toggleTheme() {
    var cur = document.documentElement.getAttribute("data-theme");
    if (!cur) cur = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    var next = cur === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem(THEME_KEY, next); } catch (e) {}
  }

  /* ---------------- mobile nav ---------------- */
  var body = document.body;
  function toggleNav(force) {
    var open = typeof force === "boolean" ? force : !body.classList.contains("nav-open");
    body.classList.toggle("nav-open", open);
    var scrim = document.getElementById("searchOverlay");
    if (scrim) scrim.hidden = !open;
  }

  /* ---------------- deep-link alignment ----------------
     The browser's own hash scroll happens before every table is laid out and can
     be interrupted, so re-align explicitly once the page is complete. */
  function alignHash() {
    var id = (location.hash || "").replace("#", "");
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) return;
    var bar = document.querySelector(".topbar");
    var off = (bar ? bar.getBoundingClientRect().height : 0) + 14;
    var y = el.getBoundingClientRect().top + window.scrollY - off;
    window.scrollTo({ top: y < 0 ? 0 : y, behavior: "auto" });
  }
  addEventListener("load", function () { [0, 60, 250, 600].forEach(function (d) { setTimeout(alignHash, d); }); });
  document.addEventListener("DOMContentLoaded", function () { [0, 60, 250].forEach(function (d) { setTimeout(alignHash, d); }); });
  addEventListener("hashchange", function () { setTimeout(alignHash, 0); });

  /* ---------------- progress bar ---------------- */
  var prog = document.getElementById("progress");
  var progBar = prog ? document.createElement("i") : null;
  if (progBar) prog.appendChild(progBar);
  function onScroll() {
    if (!progBar) return;
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    var pct = max > 0 ? (h.scrollTop / max) * 100 : 0;
    progBar.style.width = pct.toFixed(2) + "%";
  }
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------------- scroll spy ---------------- */
  var links = {};
  Array.prototype.forEach.call(document.querySelectorAll(".navtopics a"), function (a) {
    var id = (a.getAttribute("href") || "").replace("#", "");
    if (id) links[id] = a;
  });
  var topics = document.querySelectorAll("article.topic[id]");
  if (topics.length && "IntersectionObserver" in window) {
    var current = null;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var a = links[en.target.id];
        if (!a) return;
        if (current) current.classList.remove("on");
        a.classList.add("on");
        current = a;
        // keep the active item visible in the sidebar
        var side = document.getElementById("sidebar");
        if (side && side.scrollHeight > side.clientHeight + 8) {
          var r = a.getBoundingClientRect(), sr = side.getBoundingClientRect();
          if (r.top < sr.top + 60 || r.bottom > sr.bottom - 60) {
            side.scrollTop += (r.top - sr.top) - (sr.height / 2 - r.height / 2);
          }
        }
      });
    }, { rootMargin: "-72px 0px -68% 0px", threshold: 0 });
    Array.prototype.forEach.call(topics, function (t) { io.observe(t); });
  }

  /* ---------------- search ---------------- */
  var DATA = null, loading = false, pending = false;
  var base = isHome ? ROOT + "condensed/" : "";
  var indexUrl = ROOT + "" + "search-" + (isHome ? "condensed" : ED) + ".json";

  function loadInline(key) {
    return new Promise(function (resolve) {
      if (window.ANAT_IDX && window.ANAT_IDX[key]) return resolve(window.ANAT_IDX[key]);
      var s = document.createElement("script");
      s.src = ROOT + "" + "search-" + key + ".js" + (VER ? "?v=" + VER : "");
      s.onload = function () { resolve((window.ANAT_IDX && window.ANAT_IDX[key]) || null); };
      s.onerror = function () { resolve(null); };
      document.head.appendChild(s);
    });
  }

  function load() {
    if (DATA || loading) return Promise.resolve(DATA);
    var key = isHome ? "condensed" : ED;
    if (window.ANAT_IDX && window.ANAT_IDX[key]) { DATA = window.ANAT_IDX[key]; return Promise.resolve(DATA); }
    loading = true;
    return loadInline(key).then(function (idx) {
      if (idx) { DATA = idx; loading = false; return idx; }
      return fetch(indexUrl)
        .then(function (r) { return r.json(); })
        .then(function (j) { DATA = j; loading = false; return j; })
        .catch(function () { loading = false; return null; });
    });
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  function mark(text, toks) {
    var out = esc(text);
    toks.forEach(function (t) {
      if (t.length < 2) return;
      var re = new RegExp("(" + t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "gi");
      out = out.replace(re, "<mark>$1</mark>");
    });
    return out;
  }
  function search(q) {
    if (!DATA) return [];
    var toks = q.toLowerCase().split(/\s+/).filter(function (t) { return t.length > 0; });
    if (!toks.length) return [];
    var hits = [];
    for (var i = 0; i < DATA.length; i++) {
      var d = DATA[i];
      var title = d.t.toLowerCase(), text = d.x.toLowerCase(), tag = d.p + "." + d.n;
      var ok = true, score = 0;
      for (var k = 0; k < toks.length; k++) {
        var t = toks[k];
        var inT = title.indexOf(t) >= 0, inX = text.indexOf(t) >= 0 || tag.indexOf(t) >= 0;
        if (!inT && !inX) { ok = false; break; }
        score += (inT ? 6 : 0) + (inX ? 2 : 0);
      }
      if (ok) hits.push({ d: d, s: score });
    }
    hits.sort(function (a, b) { return b.s - a.s; });
    return hits.slice(0, 14).map(function (h) { return h.d; });
  }
  function snippet(d, toks) {
    var x = d.x || "";
    var low = x.toLowerCase(), pos = -1;
    for (var i = 0; i < toks.length; i++) {
      var p = low.indexOf(toks[i]);
      if (p >= 0) { pos = p; break; }
    }
    if (pos < 0) return x.slice(0, 150);
    var start = Math.max(0, pos - 60);
    return (start > 0 ? "…" : "") + x.slice(start, start + 170) + "…";
  }

  function bind(input, box) {
    if (!input || !box) return;
    var timer = null, items = [], sel = -1;

    function close() { box.hidden = true; box.innerHTML = ""; items = []; sel = -1; }
    function open() { box.hidden = false; }

    function render(q) {
      if (!q.trim()) { close(); return; }
      var toks = q.toLowerCase().split(/\s+/).filter(Boolean);
      var res = search(q);
      open();
      if (!res.length) {
        box.innerHTML = '<div class="empty">No topic matches “' + esc(q) + '”. Try a single word — e.g. <em>brachial</em>, <em>lymph</em>, <em>orcein</em>.</div>';
        return;
      }
      var html = ['<div class="res">'];
      res.forEach(function (d, i) {
        html.push('<a href="' + base + d.u + "#" + d.id + '" data-i="' + i + '">' +
          '<div class="r-top"><span class="r-no">' + d.p + "." + d.n + "</span>" +
          '<span class="r-t">' + mark(d.t, toks) + "</span></div>" +
          '<div class="r-x">' + mark(snippet(d, toks), toks) + "</div>" +
          '<div class="r-e">' + (isHome ? "Condensed edition" : "") + "</div></a>");
      });
      html.push("</div>");
      box.innerHTML = html.join("");
      items = Array.prototype.slice.call(box.querySelectorAll("a"));
      sel = -1;
    }

    input.addEventListener("focus", function () { load(); });
    input.addEventListener("input", function () {
      var q = input.value;
      clearTimeout(timer);
      timer = setTimeout(function () { render(q); }, 90);
    });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { close(); input.blur(); return; }
      if (!items.length) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        sel += e.key === "ArrowDown" ? 1 : -1;
        if (sel < 0) sel = items.length - 1;
        if (sel >= items.length) sel = 0;
        items.forEach(function (a) { a.classList.remove("on"); });
        items[sel].classList.add("on");
        items[sel].scrollIntoView({ block: "nearest" });
      } else if (e.key === "Enter") {
        e.preventDefault();
        (items[sel] || items[0]).click();
      }
    });
    document.addEventListener("click", function (e) {
      if (!box.contains(e.target) && e.target !== input) close();
    });
    return { close: close, input: input };
  }

  var s1 = bind(document.getElementById("q"), document.getElementById("results"));
  var s2 = bind(document.getElementById("q2"), document.getElementById("results2"));

  /* ---------------- global keys & buttons ---------------- */
  document.addEventListener("keydown", function (e) {
    var tag = (e.target.tagName || "").toLowerCase();
    var typing = tag === "input" || tag === "textarea" || e.target.isContentEditable;
    if (typing) return;
    if (e.key === "/" || e.key === "s") {
      e.preventDefault();
      var q = document.getElementById("q") || document.getElementById("q2");
      if (q) q.focus();
    } else if (e.key === "t") {
      toggleTheme();
    } else if (e.key === "c") {
      toggleNav();
    }
  });

  var navBtn = document.getElementById("navToggle");
  if (navBtn) navBtn.addEventListener("click", function () { toggleNav(); });
  var thBtn = document.getElementById("themeToggle");
  if (thBtn) thBtn.addEventListener("click", toggleTheme);
  var scrim = document.getElementById("searchOverlay");
  if (scrim) scrim.addEventListener("click", function () { toggleNav(false); });

  // topbar shrink on scroll (subtle)
  var bar = document.querySelector(".topbar");
  if (bar) {
    var onS = function () { bar.classList.toggle("scrolled", scrollY > 8); };
    addEventListener("scroll", onS, { passive: true }); onS();
  }
})();
