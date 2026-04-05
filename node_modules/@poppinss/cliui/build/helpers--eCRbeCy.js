import stringWidth from "string-width";
import cliTruncate from "cli-truncate";
import process from "node:process";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import tty from "node:tty";
const defaultColumns = 80;
const defaultRows = 24;
const exec = (command, arguments_, { shell, env } = {}) => execFileSync(command, arguments_, {
	encoding: "utf8",
	stdio: [
		"ignore",
		"pipe",
		"ignore"
	],
	timeout: 500,
	shell,
	env
}).trim();
const create = (columns, rows) => ({
	columns: Number.parseInt(columns, 10),
	rows: Number.parseInt(rows, 10)
});
const createIfNotDefault = (maybeColumns, maybeRows) => {
	const { columns, rows } = create(maybeColumns, maybeRows);
	if (Number.isNaN(columns) || Number.isNaN(rows)) return;
	if (columns === defaultColumns && rows === defaultRows) return;
	return {
		columns,
		rows
	};
};
function terminalSize() {
	const { env, stdout, stderr } = process;
	if (stdout?.columns && stdout?.rows) return create(stdout.columns, stdout.rows);
	if (stderr?.columns && stderr?.rows) return create(stderr.columns, stderr.rows);
	if (env.COLUMNS && env.LINES) return create(env.COLUMNS, env.LINES);
	const fallback = {
		columns: defaultColumns,
		rows: defaultRows
	};
	if (process.platform === "win32") return tput() ?? fallback;
	if (process.platform === "darwin") return devTty() ?? tput() ?? fallback;
	return devTty() ?? tput() ?? resize() ?? fallback;
}
const devTty = () => {
	try {
		const flags = process.platform === "darwin" ? fs.constants.O_EVTONLY | fs.constants.O_NONBLOCK : fs.constants.O_NONBLOCK;
		const { columns, rows } = tty.WriteStream(fs.openSync("/dev/tty", flags));
		return {
			columns,
			rows
		};
	} catch {}
};
const tput = () => {
	try {
		const columns = exec("tput", ["cols"], { env: {
			TERM: "dumb",
			...process.env
		} });
		const rows = exec("tput", ["lines"], { env: {
			TERM: "dumb",
			...process.env
		} });
		if (columns && rows) return createIfNotDefault(columns, rows);
	} catch {}
};
const resize = () => {
	try {
		const size = exec("resize", ["-u"]).match(/\d+/g);
		if (size.length === 2) return createIfNotDefault(size[0], size[1]);
	} catch {}
};
function createWordWrapper(start, stop) {
	const mode = "soft";
	const re = mode === "hard" ? /\b/ : /(\S+\s+)/;
	return function(text) {
		return text.toString().split(re).reduce(function(acc, x) {
			if (mode === "hard") for (let i = 0; i < x.length; i += stop - start) acc.push(x.slice(i, i + stop - start));
			else acc.push(x);
			return acc;
		}, []).reduce(function(lines, rawChunk) {
			if (rawChunk === "") return lines;
			const chunk = rawChunk.replace(/\t/g, "    ");
			const i = lines.length - 1;
			if (lines[i].length + chunk.length > stop) {
				lines[i] = lines[i].replace(/\s+$/, "");
				chunk.split(/\n/).forEach(function(c) {
					lines.push(new Array(start + 1).join(" ") + c.replace(/^\s+/, ""));
				});
			} else if (chunk.match(/\n/)) {
				const xs = chunk.split(/\n/);
				lines[i] += xs.shift();
				xs.forEach(function(c) {
					lines.push(new Array(start + 1).join(" ") + c.replace(/^\s+/, ""));
				});
			} else lines[i] += chunk;
			return lines;
		}, [new Array(start + 1).join(" ")]).join("\n");
	};
}
const TERMINAL_SIZE = terminalSize().columns;
function applyPadding(value, options) {
	if (options.paddingLeft) value = `${options.paddingChar.repeat(options.paddingLeft)}${value}`;
	if (options.paddingRight) value = `${value}${options.paddingChar.repeat(options.paddingRight)}`;
	return value;
}
function justify(columns, options) {
	const normalizedOptions = {
		align: "left",
		paddingChar: " ",
		...options
	};
	return columns.map((column) => {
		const columnWidth = stringWidth(column);
		if (columnWidth >= normalizedOptions.maxWidth) return column;
		if (normalizedOptions.align === "left") return applyPadding(column, {
			paddingChar: normalizedOptions.paddingChar,
			paddingRight: normalizedOptions.maxWidth - columnWidth
		});
		return applyPadding(column, {
			paddingChar: normalizedOptions.paddingChar,
			paddingLeft: normalizedOptions.maxWidth - columnWidth
		});
	});
}
function wrap(columns, options) {
	const wrapper = createWordWrapper(options.startColumn, options.endColumn);
	if (options.trimStart) return columns.map((column) => wrapper(column).trimStart());
	return columns.map((column) => wrapper(column));
}
function truncate(columns, options) {
	return columns.map((column) => cliTruncate(column, options.maxWidth, {
		truncationCharacter: options.truncationChar || "…",
		position: options.position || "end"
	}));
}
export { wrap as i, justify as n, truncate as r, TERMINAL_SIZE as t };
