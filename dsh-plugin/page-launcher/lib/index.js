// @dsh-external/dsh-client-ui-page-launcher — host half
//
// 扫描工作区里「做过的页面」（含 index.html 的目录），并把它们伺服出来：
//   GET  /api/dsh/pages              列出所有页面（标题、路径、节数、大小、修改时间）
//   GET  /api/dsh/pages/view?slug=x  把该页面的 index.html 原样返回（新标签页里打开）
//   GET  /api/dsh/pages/icon         桌宠用的图片（assets/pet.*）
//   POST /api/dsh/pages/open         用系统默认浏览器打开（{ slug }）
//
// 页面是自包含的单文件，所以直接原样返回即可，不需要任何静态资源处理。
import { spawn } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const name = "ui-page-launcher";
export const inject = ["webServer"];

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIST_PATH = "/api/dsh/pages";
const VIEW_PATH = "/api/dsh/pages/view";
const ICON_PATH = "/api/dsh/pages/icon";
const OPEN_PATH = "/api/dsh/pages/open";

// 桌宠图片：想换形象就把 assets/ 下的 pet.* 换掉（png/jpg/gif/webp/svg 都认）
const ICON_DIR = join(__dirname, "..", "assets");
const ICON_NAMES = ["pet.png", "pet.gif", "pet.webp", "pet.jpg", "pet.jpeg", "pet.svg"];
const ICON_TYPES = {
  ".png": "image/png", ".gif": "image/gif", ".webp": "image/webp",
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".svg": "image/svg+xml"
};

/* ---------------------------------------------------------------- 工作区定位 */

/**
 * 工作区 = 「放着学习页面和 learning-pages/ 的那个目录」。
 * 从插件自身位置往上找，命中下面任一标记就认定是工作区根：
 *   .plugin-tools   插件被放在工作区的 .plugin-tools/repo/<名字>/ 下
 *   learning-pages  学习页范式的目录（公开仓库里的布局）
 * 都不命中就退回 dsh 的启动目录（dsh web 通常就是从工作区根启动的）。
 */
const WORKSPACE_MARKERS = [".plugin-tools", "learning-pages"];

function findWorkspace() {
  let dir = __dirname;
  for (let i = 0; i < 8; i++) {
    for (const marker of WORKSPACE_MARKERS) {
      if (existsSync(join(dir, marker))) return dir;
    }
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return process.cwd();
}

const WORKSPACE = findWorkspace();

/* ---------------------------------------------------------------- 页面扫描 */

/** 从 content.js 里轻轻抓一点元信息（不执行它）。 */
function readSourceMeta(dir) {
  const src = join(dir, "content.js");
  if (!existsSync(src)) return null;
  try {
    const text = readFileSync(src, "utf8");
    const brand = text.match(/brand\s*:\s*(?:"([^"]*)"|'([^']*)')/);
    const sub = text.match(/subtitle\s*:\s*(?:"([^"]*)"|'([^']*)')/);
    const steps = (text.match(/^\s*id\s*:\s*["']/gm) || []).length;
    return {
      brand: brand ? brand[1] || brand[2] || "" : "",
      subtitle: sub ? sub[1] || sub[2] || "" : "",
      steps
    };
  } catch {
    return null;
  }
}

function listPages() {
  let entries;
  try {
    entries = readdirSync(WORKSPACE, { withFileTypes: true });
  } catch {
    return [];
  }
  const out = [];
  for (const ent of entries) {
    if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
    const dir = join(WORKSPACE, ent.name);
    const html = join(dir, "index.html");
    if (!existsSync(html)) continue;

    let st;
    try {
      st = statSync(html);
    } catch {
      continue;
    }
    const meta = readSourceMeta(dir);
    out.push({
      slug: ent.name,
      title: (meta && meta.brand) || ent.name,
      subtitle: (meta && meta.subtitle) || "",
      steps: meta ? meta.steps : 0,
      framed: !!meta,                       // 是否为本范式产出的页面
      dir,
      htmlPath: html,
      size: st.size,
      mtime: st.mtime.toISOString(),
      url: VIEW_PATH + "?slug=" + encodeURIComponent(ent.name)
    });
  }
  // 本范式产出的页面排前面，然后按修改时间倒序
  out.sort((a, b) => (Number(b.framed) - Number(a.framed)) || String(b.mtime).localeCompare(String(a.mtime)));
  return out;
}

/** slug → 目录，只允许工作区的直接子目录（挡掉 ../ 之类的路径穿越）。 */
function resolveSlug(slug) {
  const s = String(slug || "");
  if (!s || s.includes("/") || s.includes("\\") || s.includes("..") || s.startsWith(".")) return null;
  const dir = join(WORKSPACE, s);
  if (dirname(resolve(dir)) !== resolve(WORKSPACE)) return null;
  const html = join(dir, "index.html");
  if (!existsSync(html)) return null;
  return html;
}

/* ---------------------------------------------------------------- HTTP 辅助 */

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function sameOrigin(req) {
  if (req.headers["sec-fetch-site"] === "cross-site") return false;
  const origin = req.headers.origin;
  if (typeof origin !== "string" || origin === "" || origin === "null") return true;
  const host = req.headers.host;
  if (typeof host !== "string" || host === "") return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

function readBody(req) {
  return new Promise((resolvePromise, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 65536) {
        reject(new Error("body-too-large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolvePromise(chunks.length === 0 ? {} : JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new Error("invalid-json"));
      }
    });
    req.on("error", reject);
  });
}

/* ---------------------------------------------------------------- 系统浏览器 */

function psExecutable() {
  const sysRoot = process.env.SystemRoot || process.env.windir || "";
  if (sysRoot) {
    const full = join(sysRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    if (existsSync(full)) return full;
  }
  return "powershell.exe";
}

/** 用系统默认浏览器打开一个本地文件（最省事的跨浏览器方案）。 */
function openWithShell(target) {
  return new Promise((resolvePromise, reject) => {
    let child;
    try {
      child = spawn(
        psExecutable(),
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command",
         "Start-Process -LiteralPath $args[0]", target],
        { windowsHide: true }
      );
    } catch (error) {
      reject(error);
      return;
    }
    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* noop */ }
      reject(new Error("打开超时"));
    }, 15000);
    child.on("error", (error) => { clearTimeout(timer); reject(error); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolvePromise();
      else reject(new Error("Start-Process 退出码 " + code));
    });
  });
}

/* ---------------------------------------------------------------- 路由 */

function makeListRoute() {
  return {
    kind: "exact",
    path: LIST_PATH,
    async handler(req, res) {
      if (!sameOrigin(req)) return json(res, 403, { ok: false, error: "cross-site-request-rejected" });
      if (req.method !== "GET") return json(res, 405, { ok: false, error: "method-not-allowed" });
      try {
        const pages = listPages();
        json(res, 200, {
          ok: true,
          workspace: WORKSPACE,
          pages,
          at: new Date().toISOString()
        });
      } catch (error) {
        json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
  };
}

function makeViewRoute() {
  return {
    kind: "exact",
    path: VIEW_PATH,
    async handler(req, res) {
      if (!sameOrigin(req)) return json(res, 403, { ok: false, error: "cross-site-request-rejected" });
      if (req.method !== "GET") return json(res, 405, { ok: false, error: "method-not-allowed" });
      let slug = "";
      try {
        slug = new URL(req.url, "http://localhost").searchParams.get("slug") || "";
      } catch {
        /* 忽略 */
      }
      const file = resolveSlug(slug);
      if (!file) return json(res, 404, { ok: false, error: "页面不存在" });
      try {
        const html = readFileSync(file, "utf8");
        res.writeHead(200, {
          "content-type": "text/html; charset=utf-8",
          "cache-control": "no-store"
        });
        res.end(html);
      } catch (error) {
        json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
  };
}

function makeOpenRoute() {
  return {
    kind: "exact",
    path: OPEN_PATH,
    async handler(req, res) {
      if (!sameOrigin(req)) return json(res, 403, { ok: false, error: "cross-site-request-rejected" });
      if (req.method !== "POST") return json(res, 405, { ok: false, error: "method-not-allowed" });
      try {
        const body = await readBody(req);
        const file = resolveSlug(body && body.slug);
        if (!file) return json(res, 404, { ok: false, error: "页面不存在" });
        await openWithShell(file);
        json(res, 200, { ok: true, opened: file });
      } catch (error) {
        json(res, 400, { ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
  };
}

/** 找到桌宠图片；每次请求都重新找一个，换图后刷新页面即可生效。 */
function resolveIcon() {
  for (const name of ICON_NAMES) {
    const file = join(ICON_DIR, name);
    if (existsSync(file)) return file;
  }
  return null;
}

function makeIconRoute() {
  return {
    kind: "exact",
    path: ICON_PATH,
    async handler(req, res) {
      if (!sameOrigin(req)) return json(res, 403, { ok: false, error: "cross-site-request-rejected" });
      if (req.method !== "GET") return json(res, 405, { ok: false, error: "method-not-allowed" });
      const file = resolveIcon();
      if (!file) return json(res, 404, { ok: false, error: "没有桌宠图片（放一个 assets/pet.png）" });
      try {
        const buf = readFileSync(file);
        const dot = file.lastIndexOf(".");
        res.writeHead(200, {
          "content-type": ICON_TYPES[file.slice(dot).toLowerCase()] || "application/octet-stream",
          "content-length": buf.length,
          "cache-control": "no-cache"          // 换图后刷新就能看到
        });
        res.end(buf);
      } catch (error) {
        json(res, 500, { ok: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
  };
}

/* ---------------------------------------------------------------- 插件入口 */

export function apply(ctx) {
  return ctx.effect(() => {
    if (ctx.webServer && typeof ctx.webServer.register === "function") {
      ctx.webServer.register(makeListRoute());
      ctx.webServer.register(makeViewRoute());
      ctx.webServer.register(makeIconRoute());
      ctx.webServer.register(makeOpenRoute());
    }
    console.log("[page-launcher] 工作区 = " + WORKSPACE + "，桌宠图片 = " + (resolveIcon() || "未找到"));
    return () => { /* 路由随 fiber 释放 */ };
  }, "ui-page-launcher: routes");
}
