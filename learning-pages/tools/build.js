#!/usr/bin/env node
/* =========================================================================
   build.js —— 把 theme.css + content.js + engine.js 合成为一个自包含的 index.html
   -------------------------------------------------------------------------
   用法：
     node learning-pages/tools/build.js <页面目录>
     node learning-pages/tools/build.js --all        # 重建工作区里所有页面
   产物：<页面目录>/index.html（无外部依赖，双击即用，可单独发给别人）
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ENGINE_DIR = path.resolve(__dirname, '..', 'engine');
const WORKSPACE  = path.resolve(__dirname, '..', '..');   // learning-pages 的上一级

function read(p) { return fs.readFileSync(p, 'utf8'); }

/* 用 split/join 替换，避免字符串里的 $& / $1 被当成替换模式 */
function put(tpl, token, text) { return tpl.split(token).join(text); }

function loadMeta(contentSrc, pageDir) {
  const sandbox = { window: {}, console };
  sandbox.window = sandbox;
  try {
    vm.runInNewContext(contentSrc, sandbox, { filename: path.join(pageDir, 'content.js') });
  } catch (e) {
    throw new Error('content.js 执行失败：' + e.message);
  }
  const PAGE = sandbox.PAGE || (sandbox.window && sandbox.window.PAGE);
  if (!PAGE) throw new Error('content.js 里没有给 window.PAGE 赋值');
  if (!Array.isArray(PAGE.steps) || !PAGE.steps.length) throw new Error('PAGE.steps 为空');
  return PAGE;
}

function build(pageDir) {
  const contentFile = path.join(pageDir, 'content.js');
  if (!fs.existsSync(contentFile)) throw new Error('找不到 ' + contentFile);

  const contentSrc = read(contentFile);
  const PAGE = loadMeta(contentSrc, pageDir);
  const META = PAGE.meta || {};
  const steps = PAGE.steps;

  let theme = read(path.join(ENGINE_DIR, 'theme.css'));
  if (META.extraCss) theme += '\n/* ---- page extraCss ---- */\n' + META.extraCss;

  let html = read(path.join(ENGINE_DIR, 'shell.html'));
  html = put(html, '{{DOC_TITLE}}', META.docTitle || META.brand || '学习页面');
  html = put(html, '{{BRAND}}',     META.brand    || '学习页面');
  html = put(html, '{{SUBTITLE}}',  META.subtitle || '');
  html = put(html, '<!--{{THEME}}-->',   theme);
  html = put(html, '<!--{{CONTENT}}-->', contentSrc);
  html = put(html, '<!--{{ENGINE}}-->',  read(path.join(ENGINE_DIR, 'engine.js')));

  const outFile = path.join(pageDir, 'index.html');
  fs.writeFileSync(outFile, html, 'utf8');

  // 统计
  const chapters = [];
  for (const st of steps) if (chapters[chapters.length - 1] !== st.ch) chapters.push(st.ch);
  const quizzes = steps.filter(s => s.q && s.q.type === 'quiz').length;
  const surveys = steps.filter(s => s.q && s.q.type === 'survey').length;

  console.log(`✔ ${path.basename(pageDir)}`);
  console.log(`   ${steps.length} 节 · ${chapters.length} 章 · 有对错题 ${quizzes} · 引导题 ${surveys}`);
  console.log(`   -> ${outFile}  (${(Buffer.byteLength(html) / 1024).toFixed(0)} KB)`);
  return outFile;
}

function findAllPages() {
  return fs.readdirSync(WORKSPACE, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== 'learning-pages' && !d.name.startsWith('.'))
    .map(d => path.join(WORKSPACE, d.name))
    .filter(dir => fs.existsSync(path.join(dir, 'content.js')));
}

module.exports = { build, findAllPages };

/* ---------------- main ---------------- */
if (require.main === module) {
  const arg = process.argv[2];
  try {
    if (!arg || arg === '--all') {
      const pages = findAllPages();
      if (!pages.length) { console.log('没找到任何含 content.js 的页面目录'); process.exit(0); }
      pages.forEach(build);
    } else {
      build(path.resolve(arg));
    }
  } catch (e) {
    console.error('✘ 构建失败：' + e.message);
    process.exit(1);
  }
}
