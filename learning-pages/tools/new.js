#!/usr/bin/env node
/* =========================================================================
   new.js —— 新建一个学习页面（脚手架）
   -------------------------------------------------------------------------
   用法：
     node learning-pages/tools/new.js <目录名> --brand "大标题" [--subtitle "副标题"] [--title "文档标题"]
   例子：
     node learning-pages/tools/new.js git-basics --brand "Git 入门" --subtitle "零基础版"
   会在工作区根目录建 <目录名>/content.js（含三节骨架），并立刻构建出 index.html。
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');

const WORKSPACE = path.resolve(__dirname, '..', '..');
const TPL = path.join(__dirname, 'scaffold', 'content.js.tpl');

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

const slug = process.argv[2];
if (!slug || slug.startsWith('--')) {
  console.error('用法：node learning-pages/tools/new.js <目录名> --brand "大标题" [--subtitle "副标题"] [--title "文档标题"]');
  process.exit(1);
}
if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(slug)) {
  console.error('目录名只能用字母、数字、连字符、下划线');
  process.exit(1);
}

const brand    = arg('brand')    || slug;
const subtitle = arg('subtitle') || '零基础版';
const docTitle = arg('title')    || (brand + ' · 学习指南');
const storageKey = slug.replace(/-/g, '_') + '_guide_v1';

const pageDir = path.join(WORKSPACE, slug);
if (fs.existsSync(path.join(pageDir, 'content.js'))) {
  console.error(`✘ 已存在：${path.join(pageDir, 'content.js')}（请先改名或删掉它）`);
  process.exit(1);
}
fs.mkdirSync(pageDir, { recursive: true });

let out = fs.readFileSync(TPL, 'utf8');
out = out.split('{{BRAND}}').join(JSON.stringify(brand));
out = out.split('{{SUBTITLE}}').join(JSON.stringify(subtitle));
out = out.split('{{DOC_TITLE}}').join(JSON.stringify(docTitle));
out = out.split('{{STORAGE_KEY}}').join(JSON.stringify(storageKey));

fs.writeFileSync(path.join(pageDir, 'content.js'), out, 'utf8');
console.log(`✔ 已创建 ${path.join(pageDir, 'content.js')}`);
console.log(`   brand      = ${brand}`);
console.log(`   subtitle   = ${subtitle}`);
console.log(`   docTitle   = ${docTitle}`);
console.log(`   storageKey = ${storageKey}`);
console.log('');
console.log('接下来：把 content.js 里的骨架内容换成真内容，然后运行');
console.log(`   node learning-pages/tools/build.js ${pageDir}`);
console.log(`   node learning-pages/tools/validate.js ${pageDir}`);
console.log('');
require('./build.js').build(pageDir);
