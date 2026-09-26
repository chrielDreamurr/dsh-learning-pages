#!/usr/bin/env node
/* =========================================================================
   validate.js —— 内容结构校验 + 冒烟渲染
   -------------------------------------------------------------------------
   用法：
     node learning-pages/tools/validate.js <页面目录>
     node learning-pages/tools/validate.js --all
   做法：把 content.js 和 engine.js 一起放进一个带 DOM 桩的沙箱里跑一遍，
         对【每一步、每一个选项】都真实渲染一次，再检查内容规范。
   退出码非 0 表示有「错误」（警告不影响构建）。
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ENGINE = path.resolve(__dirname, '..', 'engine', 'engine.js');
const WORKSPACE = path.resolve(__dirname, '..', '..');

/* ---------------- DOM 桩 ---------------- */
function mkEl() {
  return {
    innerHTML: '', textContent: '', disabled: false, scrollTop: 0, style: {},
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
  };
}
function makeContext() {
  const nodes = {};
  const ctx = {
    console,
    document: {
      getElementById(id) { return nodes[id] || (nodes[id] = mkEl()); },
      addEventListener() {},
    },
    localStorage: { getItem(){ return null; }, setItem(){}, removeItem(){} },
  };
  ctx.window = ctx;
  ctx.confirm = () => true;
  vm.createContext(ctx);
  return ctx;
}

/* 检查 HTML 标签是否配对。先剥掉 <pre> 里的内容（代码块里可能有裸 < >），
   再统计每个标签的开合差。自闭合标签忽略。返回 [标签, 差值] 列表。 */
const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'source', 'area', 'base', 'col', 'embed', 'track', 'wbr']);
function unbalancedTags(html) {
  const stripped = String(html).replace(/<pre[\s\S]*?<\/pre>/gi, '');
  const tags = stripped.match(/<\/?[a-zA-Z][a-zA-Z0-9]*\b[^>]*>/g) || [];
  const count = {};
  for (const t of tags) {
    const name = (t.match(/^<\/?([a-zA-Z][a-zA-Z0-9]*)/) || [])[1];
    if (!name) continue;
    const n = name.toLowerCase();
    if (VOID_TAGS.has(n)) continue;
    count[n] = (count[n] || 0) + (t.startsWith('</') ? -1 : 1);
  }
  return Object.entries(count).filter(([, v]) => v !== 0);
}

/* ---------------- 检查 ---------------- */
function validate(pageDir) {
  const contentFile = path.join(pageDir, 'content.js');
  const errors = [], warns = [];

  const ctx = makeContext();
  try {
    vm.runInContext(fs.readFileSync(contentFile, 'utf8'), ctx, { filename: 'content.js' });
  } catch (e) { return { errors: ['content.js 执行失败：' + e.message], warns, stats: null }; }

  const PAGE = ctx.window.PAGE;
  if (!PAGE) return { errors: ['没有 window.PAGE'], warns, stats: null };
  const steps = PAGE.steps || [];
  if (!steps.length) return { errors: ['PAGE.steps 为空'], warns, stats: null };

  const ids = new Set();
  const chapOrder = [];
  steps.forEach((st, i) => {
    const at = `第 ${i + 1} 节 (${st.id || '无 id'})`;

    if (!st.id) errors.push(`${at}: 缺 id`);
    else if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(st.id)) errors.push(`${at}: id 含非法字符（只允许字母数字-_）`);
    else if (ids.has(st.id)) errors.push(`${at}: id 重复`);
    else ids.add(st.id);

    if (!st.ch) errors.push(`${at}: 缺 ch（章节名）`);
    if (!st.title) errors.push(`${at}: 缺 title`);
    if (!st.body || st.body.length < 40) errors.push(`${at}: body 太短或缺失`);

    // 章节必须连续，否则侧栏会出现两个同名分组
    if (st.ch !== chapOrder[chapOrder.length - 1]) {
      if (chapOrder.includes(st.ch)) errors.push(`${at}: 章节「${st.ch}」不连续（中间插了别的章节）`);
      chapOrder.push(st.ch);
    }

    // 标签检查：禁用的标签 + 配对是否平衡（真检查，不是正则猜）
    const texts = [['title', st.title], ['body', st.body], ['题面', st.q ? st.q.text : '']].concat(
      st.q ? st.q.opts.map((o, j) => [`选项 ${j + 1}`, (o.label || '') + (o.desc || '') + (o.why || '')]) : []);
    texts.forEach(([where, t]) => {
      t = t || '';
      const bad = t.match(/<bc>|<\/bc>|<(i|u|font|center|marquee|blink)>|<\/\1>/g);
      if (bad) errors.push(`${at} ${where}: 含禁用标签 ${[...new Set(bad)].join(' ')}`);
      if (/<p>\s*<\/p>/.test(t)) errors.push(`${at} ${where}: 有空段落 <p></p>`);
      const un = unbalancedTags(t);
      if (un.length) errors.push(`${at} ${where}: 标签不配对 -> ${un.map(([k, v]) => `${k}${v > 0 ? ' 多开 ' + v : ' 多闭 ' + (-v)}`).join(', ')}`);
    });

    // 题目
    if (!st.q) { warns.push(`${at}: 没有题目`); return; }
    const q = st.q;
    if (q.type !== 'quiz' && q.type !== 'survey') errors.push(`${at}: q.type 必须是 quiz 或 survey`);
    if (!q.text) errors.push(`${at}: 缺题面 q.text`);
    if (!Array.isArray(q.opts) || q.opts.length < 2) { errors.push(`${at}: 选项少于 2 个`); return; }
    if (q.opts.length > 9) warns.push(`${at}: 选项超过 9 个，数字键快捷键会失效`);

    let correctCount = 0, correctIdx = -1;
    q.opts.forEach((o, j) => {
      const oa = `${at} 选项 ${j + 1}`;
      if (!o.label) errors.push(`${oa}: 缺 label`);
      if (o.correct) { correctCount++; correctIdx = j; }
      if (q.type === 'quiz' && !o.why) errors.push(`${oa}: 缺少 why（必须解释这个选项对不对、为什么）`);
      if (o.why && o.why.length < 25) warns.push(`${oa}: why 太短（${(o.why || '').length} 字），解释不充分`);
      if (o.next !== undefined && !steps.some(x => x.id === o.next)) errors.push(`${oa}: next 指向不存在的 id「${o.next}」`);
    });

    if (q.type === 'quiz') {
      if (correctCount !== 1) errors.push(`${at}: quiz 必须恰好 1 个正确答案，现在有 ${correctCount} 个`);
      // 正确项位置不在这里检查：引擎会统一打乱，见下方的分布检查
    } else {
      if (correctCount !== 0) errors.push(`${at}: survey 不应该有 correct`);
      if (q.opts.some(o => o.next !== undefined) && q.opts.filter(o => o.next !== undefined).length < q.opts.length) {
        warns.push(`${at}: 部分选项有 next、部分没有，跳转行为会不一致`);
      }
    }
    if (!q.summary) warns.push(`${at}: 缺 q.summary（答题后的那句总结）`);
  });

  const quizSteps = steps.filter(s => s.q && s.q.type === 'quiz');

  /* ---------------- 冒烟渲染 ---------------- */
  let rendered = 0, optRenders = 0, navOk = 0, branchOk = 0, branchTotal = 0;
  try {
    vm.runInContext(fs.readFileSync(ENGINE, 'utf8'), ctx, { filename: 'engine.js' });
  } catch (e) { return { errors: errors.concat(['engine.js 执行失败：' + e.message]), warns, stats: null }; }

  const LP = ctx.window.LP;
  if (!LP) return { errors: errors.concat(['引擎没有暴露 LP']), warns, stats: null };

  // 正确答案位置分布 —— 必须在引擎运行之后统计，因为引擎会统一打乱 quiz 选项
  const liveQuiz = LP.steps.filter(s => s.q && s.q.type === 'quiz');
  const posCount = {};
  liveQuiz.forEach(s => {
    const j = s.q.opts.findIndex(o => o.correct);
    posCount[j] = (posCount[j] || 0) + 1;
  });
  const nq = liveQuiz.length;
  if (nq >= 8) {
    for (const [pos, c] of Object.entries(posCount)) {
      if (c / nq > 0.45) warns.push(`打乱后正确答案仍有 ${c}/${nq} 次落在第 ${Number(pos) + 1} 项`);
    }
    const used = Object.keys(posCount).length;
    const maxOpts = Math.max(...liveQuiz.map(s => s.q.opts.length));
    if (used < Math.min(3, maxOpts)) warns.push(`打乱后正确答案只出现在 ${used} 个位置上，分布过于集中`);
  }

  for (let i = 0; i < steps.length; i++) {
    LP.state.idx = i;
    try { LP.render(); rendered++; } catch (e) { errors.push(`${steps[i].id}: 渲染抛错 ${e.message}`); continue; }
    if (!steps[i].q) continue;
    for (let j = 0; j < steps[i].q.opts.length; j++) {
      delete LP.state.answers[steps[i].id];
      LP.state.idx = i;
      try { LP.choose(j); optRenders++; } catch (e) { errors.push(`${steps[i].id} 选项 ${j + 1}: 渲染抛错 ${e.message}`); }
      try { LP.redo(); } catch (e) {}
    }
  }
  for (let i = 0; i < steps.length; i++) {
    LP.state.idx = i;
    try { LP.go(1); LP.go(-1); navOk++; } catch (e) { errors.push(`${steps[i].id}: 导航抛错 ${e.message}`); }
  }
  steps.forEach((st, i) => {
    if (!st.q) return;
    st.q.opts.forEach((o, j) => {
      if (o.next === undefined) return;
      branchTotal++;
      LP.state.answers = {}; LP.state.idx = i;
      LP.choose(j); LP.go(1);
      if (steps[LP.state.idx].id !== o.next) errors.push(`${st.id} 选项 ${j + 1}: 应跳到 ${o.next}，实际到 ${steps[LP.state.idx].id}`);
      else branchOk++;
    });
  });
  LP.state.answers = {};

  const chapters = [];
  steps.forEach(s => { if (chapters[chapters.length - 1] !== s.ch) chapters.push(s.ch); });

  return {
    errors, warns,
    stats: {
      name: path.basename(pageDir),
      steps: steps.length,
      chapters,
      quizzes: quizSteps.length,
      surveys: steps.filter(s => s.q && s.q.type === 'survey').length,
      noQuiz: steps.filter(s => !s.q).length,
      rendered, optRenders, navOk, branchOk, branchTotal,
      meta: PAGE.meta || {},
    },
  };
}

/* ---------------- main ---------------- */
function targets() {
  const a = process.argv[2];
  if (!a || a === '--all') {
    return fs.readdirSync(WORKSPACE, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name !== 'learning-pages' && !d.name.startsWith('.'))
      .map(d => path.join(WORKSPACE, d.name))
      .filter(dir => fs.existsSync(path.join(dir, 'content.js')));
  }
  return [path.resolve(a)];
}

let failed = false, totalWarn = 0;
for (const dir of targets()) {
  const { errors, warns, stats } = validate(dir);
  console.log('──────────────────────────────────────────────');
  if (stats) {
    console.log(`📘 ${stats.name}  「${stats.meta.brand || ''}」`);
    console.log(`   ${stats.steps} 节 · ${stats.chapters.length} 章 · 有对错题 ${stats.quizzes} · 引导题 ${stats.surveys}` +
                (stats.noQuiz ? ` · 无题 ${stats.noQuiz}` : ''));
    console.log(`   渲染 ${stats.rendered}/${stats.steps} · 选项渲染 ${stats.optRenders} · 翻页 ${stats.navOk}/${stats.steps}` +
                ` · 分支 ${stats.branchOk}/${stats.branchTotal}`);
  }
  if (warns.length) {
    totalWarn += warns.length;
    console.log(`   ⚠ ${warns.length} 条提示：`);
    warns.slice(0, 25).forEach(w => console.log('     · ' + w));
    if (warns.length > 25) console.log(`     · …还有 ${warns.length - 25} 条`);
  }
  if (errors.length) {
    failed = true;
    console.log(`   ✘ ${errors.length} 条错误：`);
    errors.forEach(e => console.log('     ! ' + e));
  } else {
    console.log('   ✅ 结构校验通过');
  }
}
console.log('──────────────────────────────────────────────');
if (failed) process.exit(1);
console.log(`全部通过（${totalWarn} 条提示）`);
