// dsh-plugin-sticker — browser half
// 为 send_sticker 工具调用注册专用渲染：聊天里直接内嵌显示表情包图片（无需点击）
// 图片来自同源 HTTP 端点 /sticker-img/<name>（由本插件 server 半脸提供）
window.__ModuleLoader__.load({
	id: "dsh-plugin-sticker",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");

		const inject = ["slots"];

		function parseArgs(raw) {
			if (!raw) return null;
			try {
				const a = JSON.parse(raw);
				return a && typeof a === "object" ? a : null;
			} catch (e) {
				return null;
			}
		}

		// 状态文案（不引 locale，直接内嵌中英）
		const COPY = {
			running: { zh: "发表情包中…", en: "Sending sticker…" },
			ok: { zh: "表情包已发送", en: "Sticker sent" },
			failed: { zh: "表情包发送失败", en: "Sticker failed" },
		};

		function StickerCard(props) {
			const block = props.block;
			const settled = !!block && block.kind === "tool-result";
			const call = settled ? (block.call || block) : block;
			const args = parseArgs(call && call.argsRaw);
			const name = args && typeof args.name === "string" ? args.name : null;
			const failed = settled && !!block.isError;
			const state = !settled ? "running" : failed ? "failed" : "ok";
			const label = COPY[state] ? COPY[state].zh : state;

			const h = react.createElement;
			const headStyle = {
				display: "flex",
				alignItems: "center",
				gap: 8,
				minHeight: 22,
				fontSize: 13,
				lineHeight: 1.4,
			};
			const dotStyle = {
				width: 8,
				height: 8,
				borderRadius: 4,
				flex: "0 0 auto",
				background:
					state === "running" ? "#9aa4b2"
					: state === "failed" ? "#e5484d" : "#30a46c",
			};
			const imgStyle = {
				maxWidth: "min(320px, 78%)",
				maxHeight: 260,
				objectFit: "contain",
				borderRadius: 12,
				marginTop: 6,
				display: "block",
				background: "#f4f5f7",
				border: "1px solid rgba(128,128,128,0.15)",
			};

			const kids = [
				h("div", { key: "head", style: headStyle },
					h("span", { key: "dot", style: dotStyle }),
					h("span", { key: "label", children: label })
				)
			];

			if (state === "ok" && name) {
				kids.push(h("img", {
					key: "img",
					src: "/sticker-img/" + encodeURIComponent(name),
					alt: "表情包",
					style: imgStyle,
					loading: "lazy",
					onError: (e) => { e.currentTarget.style.opacity = "0.25"; }
				}));
			}

			return h("div", {
				"data-tool": "send_sticker",
				"data-state": state,
				style: { padding: "8px 10px", minWidth: 0 },
			}, kids);
		}

		function apply(ctx) {
			ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({
				name: "tool.call.toolview",
				key: "send_sticker",
			}, StickerCard));
		}

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
