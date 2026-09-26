/* =========================================================================
   交互式学习页 · 通用引擎
   -------------------------------------------------------------------------
   本文件与内容无关。它只读 window.PAGE：
     PAGE.meta  = { brand, subtitle, docTitle, storageKey, extraCss }
     PAGE.steps = [ { id, ch, title, tag?, body, q? } ]
   题目规范见 learning-pages/SPEC.md，改内容请改 content.js，不要改这里。
   ========================================================================= */
(function () {
  'use strict';

  var PAGE  = window.PAGE || {};
  var STEPS = PAGE.steps || [];
  var META  = PAGE.meta  || {};
  var KEY   = META.storageKey || ('learning-page::' + (META.docTitle || 'untitled'));

  if (!STEPS.length) {
    document.getElementById('content').innerHTML =
      '<div class="wrap"><h2 class="title">这个页面还没有内容</h2>' +
      '<p>请检查 <code>content.js</code> 里的 <code>window.PAGE.steps</code> 是否为空，然后重新运行构建脚本。</p></div>';
    return;
  }

  var state = { idx: 0, answers: {} };

  /* ---------------- 选项顺序打乱（防"闭眼选第一个"） ----------------
     只对 quiz 生效；survey 是分诊/自评题，顺序本身有含义，必须保持原样。
     用步骤 id 做哈希，所以同一份内容每次构建、每次刷新，顺序都完全一致。
     想保留人工排序的题目，在该题里写 keepOrder:true 即可跳过。       */
  function hash32(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h >>> 0;
  }
  function rotateQuizOptions() {
    var rotated = 0;
    for (var i = 0; i < STEPS.length; i++) {
      var st = STEPS[i], q = st.q;
      if (!q || q.type !== 'quiz' || q.keepOrder) continue;
      var opts = q.opts;
      if (!opts || opts.length < 2) continue;
      var c = -1;
      for (var j = 0; j < opts.length; j++) if (opts[j].correct) { c = j; break; }
      if (c < 0) continue;
      var n = opts.length;
      var target = (hash32(st.id) + i) % n;
      var k = ((c - target) % n + n) % n;    // 循环左移 k 位后，正确项落到 target
      if (k === 0) continue;
      q.opts = opts.slice(k).concat(opts.slice(0, k));
      rotated++;
    }
    return rotated;
  }
  rotateQuizOptions();

  /* ---------------- 查询辅助 ---------------- */
  function stepIndex(id) {
    for (var i = 0; i < STEPS.length; i++) if (STEPS[i].id === id) return i;
    return -1;
  }
  function answerOf(st) { return state.answers[st.id]; }
  function isDone(st)   { return state.answers[st.id] !== undefined; }
  function isQuiz(st)   { return !!(st.q && st.q.type === 'quiz'); }
  function score() {
    var ok = 0, tot = 0;
    for (var i = 0; i < STEPS.length; i++) {
      var st = STEPS[i];
      if (!isQuiz(st)) continue;
      tot++;
      var a = answerOf(st);
      if (a !== undefined && st.q.opts[a] && st.q.opts[a].correct) ok++;
    }
    return { ok: ok, tot: tot };
  }

  /* ---------------- 存档 ---------------- */
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        var p = JSON.parse(raw);
        if (p && typeof p.idx === 'number') state = p;
      }
    } catch (e) {}
    if (state.idx == null || state.idx < 0 || state.idx >= STEPS.length) state.idx = 0;
    if (!state.answers) state.answers = {};
  }

  /* ---------------- 侧栏 ---------------- */
  function renderNav() {
    var nav = document.getElementById('nav');
    var html = '', lastCh = null, i, st, cls;
    for (i = 0; i < STEPS.length; i++) {
      st = STEPS[i];
      if (st.ch !== lastCh) {
        html += '<div class="grp">' + (st.ch || '') + '</div>';
        lastCh = st.ch;
      }
      cls = ['', isDone(st) ? 'done' : '', i === state.idx ? 'cur' : ''].filter(Boolean).join(' ');
      html += '<a class="' + cls + '" onclick="LP.jump(' + i + ')">' +
              '<span class="dot">' + (isDone(st) ? '✓' : '') + '</span>' +
              '<span>' + (st.title || '') + '</span></a>';
    }
    nav.innerHTML = html;

    var total = STEPS.length, done = 0;
    for (i = 0; i < STEPS.length; i++) if (isDone(STEPS[i])) done++;
    var pct = Math.round(done * 100 / total);
    document.getElementById('pbar').style.width = pct + '%';
    document.getElementById('ptxt').textContent = '进度 ' + pct + '%';
    var sc = score();
    document.getElementById('ptot').textContent = done + '/' + total + ' 节 · 答对 ' + sc.ok + '/' + sc.tot;
  }

  /* ---------------- 正文 ---------------- */
  function render() {
    var st = STEPS[state.idx];
    if (!st) return;
    var sel = answerOf(st);
    var answered = sel !== undefined;

    var html = '<div class="wrap">';
    html += '<div class="crumb">' + (st.ch || '') + '</div>';
    html += '<h2 class="title">' + (st.title || '') +
            (st.tag ? '<span class="tag">' + st.tag + '</span>' : '') + '</h2>';
    html += '<div class="body">' + (st.body || '') + '</div>';

    if (st.q) {
      var q = st.q, isSurvey = q.type === 'survey';
      html += '<div class="quiz"><div class="qh">' +
              '<span class="tag' + (isSurvey ? ' sv' : '') + '">' + (isSurvey ? '选一选' : '想一想') + '</span>' +
              '<span class="qt">' + q.text + '</span></div><div class="opts">';

      for (var i = 0; i < q.opts.length; i++) {
        var o = q.opts[i], cls = ['opt'];
        if (answered) {
          cls.push('lock', 'answered');
          if (i === sel) cls.push(isSurvey ? 'reveal' : (o.correct ? 'sel-ok' : 'sel-bad'));
          else if (!isSurvey && o.correct) cls.push('reveal');
        }
        html += '<div class="' + cls.join(' ') + '" onclick="LP.choose(' + i + ')">';
        html += '<span class="num">' + (i + 1) + '</span><span class="tx">';
        html += '<span class="lb">' + o.label + '</span>';
        if (o.desc) html += '<span class="ds">' + o.desc + '</span>';
        if (answered && o.why) html += '<span class="why">' + o.why + '</span>';
        html += '</span></div>';
      }
      html += '</div>';

      if (answered) {
        if (isSurvey) {
          html += '<div class="verdict info on"><span class="lb">说明</span>' + (q.summary || '') + '</div>';
        } else if (q.opts[sel] && q.opts[sel].correct) {
          html += '<div class="verdict good on"><span class="lb">✓ 答对了</span>' + (q.summary || '') + '</div>';
        } else {
          html += '<div class="verdict bad on"><span class="lb">✗ 再看看绿色那条</span>' + (q.summary || '') +
                  '<br>点击「重答本题」可以再试一次。</div>';
        }
      }

      html += '<div class="qfoot">';
      if (answered) html += '<button class="tiny ghost" onclick="LP.redo()">重答本题</button>';
      html += '<span class="hint">' +
              (answered ? '看懂了就继续 →'
                        : '按数字键 <kbd>1</kbd>~<kbd>' + q.opts.length + '</kbd> 也可以选') +
              '</span></div></div>';
    }

    html += '</div>';
    var c = document.getElementById('content');
    c.innerHTML = html;
    c.scrollTop = 0;

    document.getElementById('crumbTop').textContent =
      (st.ch || '') + '  ·  ' + (state.idx + 1) + ' / ' + STEPS.length;
    document.getElementById('btnPrev').disabled = state.idx === 0;

    var isLast = state.idx === STEPS.length - 1;
    var nx = (answered && st.q && st.q.opts[sel]) ? st.q.opts[sel].next : null;
    document.getElementById('btnNext').textContent =
      isLast ? '完成 ✓' : (nx ? '继续 →' : '下一题 →');

    renderNav();
    save();
  }

  /* ---------------- 交互 ---------------- */
  function choose(i) {
    var st = STEPS[state.idx];
    if (!st.q || answerOf(st) !== undefined) return;
    state.answers[st.id] = i;
    render();
  }
  function redo() {
    delete state.answers[STEPS[state.idx].id];
    render();
  }
  function jump(i) {
    if (i < 0 || i >= STEPS.length) return;
    state.idx = i;
    var side = document.getElementById('side');
    if (side) side.classList.remove('open');
    render();
  }
  function go(dir) {
    var st = STEPS[state.idx];
    var sel = answerOf(st);
    if (dir > 0 && st.q && sel !== undefined && st.q.opts[sel]) {
      var nx = st.q.opts[sel].next;
      if (nx !== undefined) {
        var t = stepIndex(nx);
        if (t >= 0) { state.idx = t; render(); return; }
      }
    }
    var n = state.idx + dir;
    if (n < 0) n = 0;
    if (n >= STEPS.length) n = STEPS.length - 1;
    state.idx = n;
    render();
  }
  function resetAll() {
    if (!window.confirm('确定要清空所有进度重新开始吗？')) return;
    state = { idx: 0, answers: {} };
    save();
    render();
  }
  function toggleMenu() {
    var side = document.getElementById('side');
    if (side) side.classList.toggle('open');
  }

  /* ---------------- 启动 ---------------- */
  document.addEventListener('keydown', function (e) {
    var st = STEPS[state.idx];
    if (!st) return;
    if (e.key >= '1' && e.key <= '9') {
      var i = parseInt(e.key, 10) - 1;
      if (st.q && i < st.q.opts.length) { choose(i); e.preventDefault(); }
      return;
    }
    if (e.key === 'ArrowRight' || e.key === 'Enter') { go(1); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { go(-1); e.preventDefault(); }
  });

  window.LP = {
    choose: choose, redo: redo, jump: jump, go: go,
    resetAll: resetAll, toggleMenu: toggleMenu,
    render: render,
    state: state,
    steps: STEPS,
    meta: META,
    _score: score
  };

  load();
  render();
})();
