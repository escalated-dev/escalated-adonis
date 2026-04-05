import { n as __toESM } from "../../chunk-BNZ4_A-W.js";
import { n as isScriptFile, r as naturalSort, t as require_main } from "../../main-CdreHl1_.js";
import { extname, join, relative, sep } from "node:path";
import string from "@poppinss/string";
import { readdir, stat } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
async function fsReadAll(location, options) {
	const normalizedLocation = typeof location === "string" ? location : fileURLToPath(location);
	const normalizedOptions = Object.assign({
		absolute: false,
		sort: naturalSort
	}, options);
	const pathType = normalizedOptions.pathType || "relative";
	try {
		await stat(normalizedLocation);
	} catch (error) {
		if (normalizedOptions.ignoreMissingRoot) return [];
		throw error;
	}
	const files = (await readdir(normalizedLocation, {
		recursive: true,
		withFileTypes: true
	})).filter((dirent) => {
		if (!dirent.isFile()) return false;
		if (dirent.name.startsWith(".") || dirent.parentPath.split(sep).some((segment) => segment.startsWith("."))) return false;
		return true;
	}).map((file) => {
		switch (pathType) {
			case "relative": return join(relative(normalizedLocation, file.parentPath), file.name);
			case "absolute": return join(file.parentPath, file.name);
			case "unixRelative": return string.toUnixSlash(join(relative(normalizedLocation, file.parentPath), file.name));
			case "unixAbsolute": return string.toUnixSlash(join(file.parentPath, file.name));
			case "url": return pathToFileURL(join(file.parentPath, file.name)).href;
		}
	});
	if (normalizedOptions.filter) return files.filter(normalizedOptions.filter).sort(normalizedOptions.sort);
	return files.sort(normalizedOptions.sort);
}
var import_main = /* @__PURE__ */ __toESM(require_main());
async function importFile(basePath, fileURL, values, options) {
	const filePath = fileURLToPath(fileURL);
	const fileExtension = extname(filePath);
	const collectionKey = relative(basePath, filePath).replace(/* @__PURE__ */ new RegExp(`${fileExtension}$`), "").split(sep);
	const exportedValue = fileExtension === ".json" ? await import(fileURL, { with: { type: "json" } }) : await import(fileURL);
	import_main.default.set(values, options.transformKeys ? options.transformKeys(collectionKey) : collectionKey, exportedValue.default ? exportedValue.default : { ...exportedValue });
}
async function fsImportAll(location, options) {
	options = options || {};
	const collection = {};
	const normalizedLocation = typeof location === "string" ? location : fileURLToPath(location);
	const files = await fsReadAll(normalizedLocation, {
		filter: isScriptFile,
		...options,
		pathType: "url"
	});
	await Promise.all(files.map((file) => importFile(normalizedLocation, file, collection, options)));
	return collection;
}
export { fsImportAll, fsReadAll };
