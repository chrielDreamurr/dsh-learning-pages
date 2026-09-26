// @dsh-external/dsh-client-ui-page-launcher — client half
//
// 两处注册：
//   sidebar.footer.action  → 侧栏底部「设置」旁边的入口按钮
//   shell.overlay          → 浮在整个应用之上的页面列表面板
// 两者共享同一个模块级 store（同一份 client 模块就是单例）。
window.__ModuleLoader__.load({
	id: "@dsh-external/dsh-client-ui-page-launcher",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		const h = react.createElement;

		const API = "/api/dsh/pages";
		const ICON = "/api/dsh/pages/icon";

		// 桌宠尺寸。原来是侧栏里 16px 的小图标，这里 ×10 倍（1000%）。
		const PET_SIZE = 160;

		/* ------------------------------------------------------------ 样式 */

		const CSS = [
			// 桌宠本体
			".pl-pet{position:fixed;z-index:9990;width:160px;height:160px;display:flex;align-items:center;justify-content:center;pointer-events:auto;cursor:grab;touch-action:none;-webkit-user-select:none;user-select:none;transition:transform .16s ease}",
			".pl-pet:hover{transform:scale(1.06)}",
			".pl-pet-drag{cursor:grabbing;transition:none}",
			".pl-pet-drag .pl-pet-img{animation:none;transform:scale(1.08)}",
			".pl-pet-img{width:100%;height:100%;object-fit:contain;pointer-events:none;filter:drop-shadow(0 10px 22px rgba(0,0,0,.38));animation:pl-pet-bob 3.4s ease-in-out infinite}",
			".pl-pet-emoji{font-size:96px;line-height:1;pointer-events:none;filter:drop-shadow(0 10px 22px rgba(0,0,0,.38));animation:pl-pet-bob 3.4s ease-in-out infinite}",
			"@keyframes pl-pet-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}",
			".pl-pet-badge{position:absolute;right:4px;top:10px;min-width:24px;height:24px;padding:0 7px;border-radius:12px;background:var(--dsw-alias-brand-primary,#4a7dff);color:#fff;font-size:12.5px;font-weight:700;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,.35);pointer-events:none}",
			".pl-pet-tip{position:absolute;left:50%;bottom:-6px;transform:translateX(-50%);white-space:nowrap;font-size:11.5px;line-height:20px;padding:0 10px;border-radius:10px;background:var(--dsw-alias-bg-layer-3,rgba(20,22,26,.92));color:var(--dsw-alias-label-primary,#fff);opacity:0;transition:opacity .16s ease;pointer-events:none}",
			".pl-pet:hover .pl-pet-tip{opacity:1}",

			// 面板
			".pl-mask{position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.42);display:flex;align-items:center;justify-content:center;padding:24px;pointer-events:auto}",
			".pl-box{width:min(760px,100%);max-height:min(78vh,760px);display:flex;flex-direction:column;border-radius:16px;overflow:hidden;border:1px solid var(--dsw-alias-border-l1,#e8e8ea);background:var(--dsw-alias-bg-layer-1,#fff);color:var(--dsw-alias-label-primary,#14161a);box-shadow:0 24px 64px rgba(0,0,0,.32)}",
			".pl-head{display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid var(--dsw-alias-border-l1,#ececee)}",
			".pl-head-ico{font-size:22px;line-height:1}",
			".pl-head-t{font-size:16px;font-weight:700}",
			".pl-head-s{font-size:11.5px;color:var(--dsw-alias-label-secondary,#76797f);font-family:Consolas,monospace;margin-top:1px;word-break:break-all}",
			".pl-head-sp{flex:1}",
			".pl-bar{display:flex;align-items:center;gap:10px;padding:10px 18px;border-bottom:1px solid var(--dsw-alias-border-l1,#ececee)}",
			".pl-in{flex:1;min-width:0;border:1px solid var(--dsw-alias-border-l2,#d4d4d8);border-radius:9px;background:transparent;color:inherit;padding:7px 11px;font:13px/1.5 inherit;outline:none}",
			".pl-in:focus{border-color:var(--dsw-alias-brand-primary,#4a7dff)}",
			".pl-list{overflow:auto;padding:6px 10px 12px}",
			".pl-row{display:flex;align-items:center;gap:12px;padding:11px 10px;border-radius:11px}",
			".pl-row:hover{background:color-mix(in srgb,var(--dsw-alias-bg-layer-1,#f7f7f8) 60%,transparent);outline:1px solid var(--dsw-alias-border-l1,#ececee)}",
			".pl-main{flex:1;min-width:0}",
			".pl-title{font-size:13.5px;font-weight:600;display:flex;align-items:center;gap:8px;flex-wrap:wrap}",
			".pl-sub{font-size:12px;color:var(--dsw-alias-label-secondary,#76797f);margin-top:2px}",
			".pl-path{font-size:11.5px;color:var(--dsw-alias-label-secondary,#76797f);font-family:Consolas,monospace;margin-top:3px;word-break:break-all}",
			".pl-chip{font-size:10.5px;font-weight:600;line-height:17px;padding:0 7px;border-radius:20px;background:color-mix(in srgb,var(--dsw-alias-label-secondary,#76797f) 12%,transparent);color:var(--dsw-alias-label-secondary,#76797f);white-space:nowrap}",
			".pl-chip-on{background:color-mix(in srgb,var(--dsw-alias-brand-primary,#4a7dff) 14%,transparent);color:var(--dsw-alias-brand-primary,#4a7dff)}",
			".pl-act{display:flex;gap:6px;flex:none;align-items:center}",
			".pl-btn{border:1px solid var(--dsw-alias-border-l2,#d4d4d8);background:transparent;color:inherit;border-radius:9px;padding:6px 13px;font-size:12.5px;font-weight:600;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:5px;white-space:nowrap}",
			".pl-btn:hover{border-color:var(--dsw-alias-brand-primary,#4a7dff);color:var(--dsw-alias-brand-primary,#4a7dff)}",
			".pl-btn:disabled{opacity:.5;cursor:not-allowed}",
			".pl-btn-primary{background:var(--dsw-alias-brand-primary,#4a7dff);border-color:transparent;color:#fff}",
			".pl-btn-primary:hover{color:#fff;filter:brightness(1.08)}",
			".pl-empty{padding:34px 18px;text-align:center;color:var(--dsw-alias-label-secondary,#76797f);font-size:13px;line-height:1.8}",
			".pl-err{margin:10px 18px 0;border:1px solid color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5484d) 45%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-error-primary,#e5484d) 9%,transparent);color:var(--dsw-alias-state-error-primary,#e5484d);border-radius:10px;padding:8px 12px;font-size:12.5px;white-space:pre-wrap}",
			".pl-note{padding:10px 18px 14px;color:var(--dsw-alias-label-secondary,#76797f);font-size:11.5px;line-height:1.7;border-top:1px solid var(--dsw-alias-border-l1,#ececee)}"
		].join("\n");

		/* ------------------------------------------------------------ store */

		let state = { open: false, loading: false, err: "", pages: [], workspace: "", at: "" };
		const listeners = new Set();
		function set(patch) {
			state = Object.assign({}, state, patch);
			listeners.forEach((fn) => {
				try { fn(); } catch { /* 单个订阅者出错不影响其他 */ }
			});
		}

		const store = {
			get: () => state,
			subscribe(fn) {
				listeners.add(fn);
				return () => listeners.delete(fn);
			},
			toggle() {
				const open = !state.open;
				set({ open });
				if (open) store.load();
			},
			close() {
				set({ open: false });
			},
			async load() {
				if (state.loading) return;
				set({ loading: true, err: "" });
				try {
					const res = await fetch(API, { credentials: "same-origin" });
					const d = await res.json();
					if (!d || !d.ok) throw new Error((d && d.error) || "读取失败");
					set({
						pages: Array.isArray(d.pages) ? d.pages : [],
						workspace: d.workspace || "",
						at: d.at || "",
						loading: false
					});
				} catch (e) {
					set({ loading: false, err: String((e && e.message) || e) });
				}
			},
			async openInSystemBrowser(slug) {
				try {
					const res = await fetch(API + "/open", {
						method: "POST",
						credentials: "same-origin",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ slug })
					});
					const d = await res.json();
					if (!d || !d.ok) throw new Error((d && d.error) || "打开失败");
				} catch (e) {
					set({ err: String((e && e.message) || e) });
				}
			}
		};

		function useStore() {
			const [snap, setSnap] = react.useState(state);
			react.useEffect(() => store.subscribe(() => setSnap(store.get())), []);
			return snap;
		}

		/* ------------------------------------------------------------ 工具 */

		function fmtSize(n) {
			const b = Number(n) || 0;
			if (b < 1024) return b + " B";
			if (b < 1024 * 1024) return (b / 1024).toFixed(0) + " KB";
			return (b / 1024 / 1024).toFixed(1) + " MB";
		}

		function fmtTime(iso) {
			const d = new Date(iso);
			if (isNaN(d.getTime())) return "";
			const p = (n) => String(n).padStart(2, "0");
			return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
		}

		/* ------------------------------------------------------------ 桌宠 */

		const POS_KEY = "dsh-page-launcher:pos";

		function loadPos() {
			try {
				const raw = localStorage.getItem(POS_KEY);
				if (!raw) return null;
				const p = JSON.parse(raw);
				if (p && typeof p.x === "number" && typeof p.y === "number") return p;
			} catch { /* 存储不可用就当没存过 */ }
			return null;
		}

		function savePos(p) {
			try { localStorage.setItem(POS_KEY, JSON.stringify(p)); } catch { /* 忽略 */ }
		}

		/** 把桌宠夹在视口内（换分辨率/换显示器后不会跑到屏幕外面去）。 */
		function clampPos(p) {
			const maxX = Math.max(0, window.innerWidth - PET_SIZE - 4);
			const maxY = Math.max(0, window.innerHeight - PET_SIZE - 4);
			return { x: Math.min(Math.max(4, p.x), maxX), y: Math.min(Math.max(4, p.y), maxY) };
		}

		/** 默认位置：右下角偏上一点，避开通话框输入区。 */
		function defaultPos() {
			return clampPos({
				x: window.innerWidth - PET_SIZE - 28,
				y: window.innerHeight - PET_SIZE - 96
			});
		}

		function Pet() {
			const s = useStore();
			const [pos, setPos] = react.useState(loadPos);
			const [drag, setDrag] = react.useState(false);
			const [broken, setBroken] = react.useState(false);
			const el = react.useRef(null);
			const live = react.useRef(pos);
			const gest = react.useRef(null);
			live.current = pos;

			// 首次挂载：没存过位置就落到右下角
			react.useEffect(() => {
				if (!live.current) setPos(defaultPos());
			}, []);

			// 窗口尺寸变化时重新夹一次
			react.useEffect(() => {
				const onResize = () => setPos((p) => (p ? clampPos(p) : p));
				window.addEventListener("resize", onResize);
				return () => window.removeEventListener("resize", onResize);
			}, []);

			const onDown = (ev) => {
				if (ev.button !== 0) return;
				const node = el.current;
				if (!node) return;
				try { node.setPointerCapture(ev.pointerId); } catch { /* 忽略 */ }
				const start = live.current || defaultPos();
				gest.current = {
					id: ev.pointerId,
					sx: ev.clientX,
					sy: ev.clientY,
					ox: start.x,
					oy: start.y,
					moved: false
				};
				setDrag(true);
				ev.preventDefault();
			};

			const onMove = (ev) => {
				const g = gest.current;
				if (!g || g.id !== ev.pointerId) return;
				const dx = ev.clientX - g.sx;
				const dy = ev.clientY - g.sy;
				if (!g.moved && Math.abs(dx) + Math.abs(dy) > 4) g.moved = true;
				if (g.moved) setPos(clampPos({ x: g.ox + dx, y: g.oy + dy }));
			};

			const onUp = (ev) => {
				const g = gest.current;
				if (!g || g.id !== ev.pointerId) return;
				gest.current = null;
				setDrag(false);
				try { el.current && el.current.releasePointerCapture(ev.pointerId); } catch { /* 忽略 */ }
				if (g.moved) {
					if (live.current) savePos(live.current);
				} else {
					store.toggle();          // 没拖动 = 一次点击
				}
			};

			// 右键复位到右下角
			const onReset = (ev) => {
				ev.preventDefault();
				const p = defaultPos();
				setPos(p);
				savePos(p);
			};

			const style = pos ? { left: pos.x + "px", top: pos.y + "px" } : { left: "-9999px", top: "0px" };
			const n = s.pages.length;

			return h(
				"div",
				{
					ref: el,
					className: "pl-pet" + (drag ? " pl-pet-drag" : ""),
					style,
					onPointerDown: onDown,
					onPointerMove: onMove,
					onPointerUp: onUp,
					onPointerCancel: onUp,
					onContextMenu: onReset,
					title: "点一下看页面 · 拖动挪位置 · 右键复位"
				},
				broken
					? h("span", { className: "pl-pet-emoji" }, "📚")
					: h("img", {
							className: "pl-pet-img",
							src: ICON,
							alt: "页面",
							draggable: false,
							onError: () => setBroken(true)
						}),
				n ? h("span", { className: "pl-pet-badge" }, String(n)) : null,
				h("span", { className: "pl-pet-tip" }, n ? `${n} 个页面` : "做过的页面")
			);
		}

		/* ------------------------------------------------------------ 面板 */

		function Panel(props) {
			const s = useStore();
			const [q, setQ] = react.useState("");

			react.useEffect(() => {
				if (!s.open) return undefined;
				const onKey = (ev) => {
					if (ev.key === "Escape") {
						ev.stopPropagation();
						store.close();
					}
				};
				document.addEventListener("keydown", onKey, true);
				return () => document.removeEventListener("keydown", onKey, true);
			}, [s.open]);

			if (!s.open) return null;

			const kw = q.trim().toLowerCase();
			const rows = kw
				? s.pages.filter((p) =>
						(p.title || "").toLowerCase().includes(kw) ||
						(p.slug || "").toLowerCase().includes(kw) ||
						(p.subtitle || "").toLowerCase().includes(kw))
				: s.pages;

			return h(
				"div",
				{ className: "pl-mask", onClick: () => store.close() },
				h(
					"div",
					{ className: "pl-box", onClick: (ev) => ev.stopPropagation() },
					h(
						"div",
						{ className: "pl-head" },
						h("span", { className: "pl-head-ico" }, "📚"),
						h(
							"div",
							null,
							h("div", { className: "pl-head-t" }, "做过的页面"),
							h("div", { className: "pl-head-s" }, s.workspace || "工作区尚未确定")
						),
						h("span", { className: "pl-head-sp" }),
						h("button", {
							className: "pl-btn",
							onClick: () => store.load(),
							disabled: s.loading,
							type: "button"
						}, s.loading ? "读取中…" : "🔄 刷新"),
						h("button", {
							className: "pl-btn",
							onClick: () => store.close(),
							title: "关闭（Esc）",
							type: "button"
						}, "✕")
					),
					s.pages.length > 4
						? h(
								"div",
								{ className: "pl-bar" },
								h("input", {
									className: "pl-in",
									value: q,
									placeholder: "按标题或目录名筛选…",
									onChange: (ev) => setQ(ev.target.value)
								})
							)
						: null,
					s.err ? h("div", { className: "pl-err" }, s.err) : null,
					h(
						"div",
						{ className: "pl-list" },
						s.loading && s.pages.length === 0
							? h("div", { className: "pl-empty" }, "正在扫描工作区…")
							: rows.length === 0
								? h(
										"div",
										{ className: "pl-empty" },
										s.pages.length === 0
											? h("span", null,
													"还没找到任何页面。",
													h("br"),
													"在工作区里生成一个含 index.html 的目录后，刷新这里就会出现。")
											: "没有匹配「" + q + "」的页面。"
									)
								: rows.map((p) =>
										h(
											"div",
											{ className: "pl-row", key: p.slug },
											h(
												"div",
												{ className: "pl-main" },
												h(
													"div",
													{ className: "pl-title" },
													h("span", null, p.title || p.slug),
													p.framed
														? h("span", { className: "pl-chip pl-chip-on" }, (p.steps || 0) + " 节")
														: h("span", { className: "pl-chip" }, "静态页"),
													h("span", { className: "pl-chip" }, fmtSize(p.size))
												),
												p.subtitle ? h("div", { className: "pl-sub" }, p.subtitle) : null,
												h("div", { className: "pl-path" }, p.slug + "\\index.html · " + fmtTime(p.mtime))
											),
											h(
												"div",
												{ className: "pl-act" },
												h("a", {
													className: "pl-btn pl-btn-primary",
													href: p.url,
													target: "_blank",
													rel: "noreferrer",
													title: "在新标签页里打开"
												}, "打开"),
												h("button", {
													className: "pl-btn",
													onClick: () => store.openInSystemBrowser(p.slug),
													title: "用系统默认浏览器打开（不占用 DSH 标签页）",
													type: "button"
												}, "系统浏览器")
											)
										)
									)
					),
					h(
						"div",
						{ className: "pl-note" },
						"列表来自扫描工作区里含 index.html 的目录。带「N 节」标记的是用 learning-pages 范式产出的交互式学习页；「打开」走 DSH 自己的服务器，不依赖本机文件权限。"
					)
				)
			);
		}

		/* ------------------------------------------------------------ 插件入口 */

		const inject = ["slots"];

		function apply(ctx) {
			if (typeof document !== "undefined") {
				const style = document.createElement("style");
				style.textContent = CSS;
				document.head.appendChild(style);
				ctx.effect(() => () => {
					if (style.parentNode) style.parentNode.removeChild(style);
				}, "ui-page-launcher: styles");
			}
			// 先拉一次列表，这样侧栏按钮上的数量角标不用等点开就能显示
			ctx.effect(() => {
				const t = setTimeout(() => { store.load(); }, 1200);
				return () => clearTimeout(t);
			}, "ui-page-launcher: initial scan");
			// 桌宠：可拖动的浮动形象（原来挂在侧栏底部的固定按钮已移除）
			ctx.slots.inject("shell.overlay", () =>
				ctx.slots.register({ name: "shell.overlay", id: "page-launcher-pet", order: 10 }, Pet)
			);
			// 面板：点桌宠后弹出
			ctx.slots.inject("shell.overlay", () =>
				ctx.slots.register({ name: "shell.overlay", id: "page-launcher-panel", order: 20 }, Panel)
			);
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
