import { copyFile, exists, mkdir, readDir, readTextFile, remove, rename, writeTextFile } from "@tauri-apps/plugin-fs";
import {
	IGNORE,
	managedSRC,
	managedTGT,
	OLD_managedSRC,
	OLD_managedTGT,
	OLD_RESTORE,
	RESTORE,
	UNCATEGORIZED,
	VERSION,
} from "./consts";
import {
	CATEGORIES,
	DATA,
	DOWNLOAD_LIST,
	ERR,
	LAST_UPDATED,
	MOD_LIST,
	PRESETS,
	PROGRESS_OVERLAY,
	SETTINGS,
	SOURCE,
	store,
	TARGET,
	TEXT_DATA,
	XXMI_DIR,
	XXMI_MODE,
} from "./vars";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { join } from "./utils";
import { main, updateConfig } from "./init";
import { addToast } from "@/_Toaster/ToastProvider";
import {
	Category,
	ChangeInfo,
	DirEntry,
	GameConfig,
	GlobalSettings,
	Mod,
	ModDataObj,
	ModHotKeys,
	Settings,
} from "./types";
import { openPath } from "@tauri-apps/plugin-opener";
import { error, info } from "@/lib/logger";

const textMSG = {
	rem: "Removing current files",
	disc: "Discovering files",
	file: "File",
};
let completedFiles = 0;
let totalFiles = 0;
let canceled = false;
let result = "Ok";
let progressBar: HTMLElement | null = null;
let progressMessage: HTMLElement | null = null;
let progressPerct: HTMLElement | null = null;
// Initialize Intl.Collator for faster string comparison
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

const sp = [UNCATEGORIZED, IGNORE, OLD_RESTORE];
let recentlyDownloaded: string[] = [];
store.sub(DOWNLOAD_LIST, () => {
	recentlyDownloaded = store.get(DOWNLOAD_LIST).completed.map((item: any) => item.path);
});
let src = "";
let rootReplace = "";
let modRoot = "";
let tgt = "";
let textData = store.get(TEXT_DATA);
store.sub(TEXT_DATA, () => {
	textData = store.get(TEXT_DATA);
});
store.sub(SOURCE, () => {
	src = store.get(SOURCE);
	modRoot = join(src, managedSRC);
	rootReplace = modRoot;
});
store.sub(TARGET, () => {
	tgt = store.get(TARGET);
});

export async function setConfig(config: any) {
	info("[IMM] Setting config...");
	if (!config) return;
	if (config.version && config.version < "2.1.0") {
		info("[IMM] Old config version, migrating...");
		await updateConfig(config);
		addToast({ type: "success", message: textData._Toasts.SuccessPort });
		main();
		return;
	}
	let { gameConfig: curConfig } = getConfig(store.get(SETTINGS));
	info("[IMM] Current config:", { ...curConfig });
	info("[IMM] New config:", config);
	if (!curConfig.game || !config.game || curConfig.game !== config.game) {
		addToast({ type: "error", message: textData._Toasts.GameConfigMismatch });
		return;
	}
	config.version = VERSION;
	await writeTextFile(`config${curConfig.game}.json`, JSON.stringify(config, null, 2));
	// store.set(INIT_DONE,false)
	addToast({ type: "success", message: textData._Toasts.ConfigLoaded });
	main();
}
export function getConfig(settings: Settings) {
	const config: GlobalSettings = settings.global;
	config["updatedAt"] = new Date().toISOString();
	config["version"] = VERSION;
	config["XXMI"] = store.get(XXMI_DIR) || "";
	const xxmiMode = store.get(XXMI_MODE) || 0;
	const gameConfig: GameConfig = {
		version: VERSION,
		custom: xxmiMode,
		sourceDir: xxmiMode ? store.get(SOURCE) || "" : "",
		targetDir: xxmiMode ? store.get(TARGET) || "" : "",
		game: settings.global.game,
		settings: settings.game,
		data: store.get(DATA) || {},
		presets: store.get(PRESETS) || [],
		updatedAt: new Date().toISOString(),
		categories: store.get(CATEGORIES) || [],
	};
	return { config, gameConfig };
}
export async function saveConfigs(skip = false, settings = store.get(SETTINGS)) {
	info("[IMM] Saving configs...");
	try {
		const { config, gameConfig } = getConfig(settings);
		const promises: Promise<void>[] = [];
		promises.push(writeTextFile("config.json", JSON.stringify(config, null, 2)));
		if (config.game && !skip) {
			promises.push(writeTextFile(`config${config.game}.json`, JSON.stringify(gameConfig, null, 2)));
		}
		await Promise.all(promises);
	} catch (error) {
		//console.error("Error saving configs:", error);
		throw error;
	}
}
export async function selectPath(
	options = { multiple: false, directory: false } as {
		multiple?: boolean;
		directory?: boolean;
		defaultPath?: string;
		title?: string;
		filters?: { name: string; extensions: string[] }[];
	}
) {
	return await open(options);
}
export function folderSelector(path = "", title: string | undefined = undefined) {
	return selectPath({ directory: true, ...(path ? { defaultPath: path } : {}), ...(title ? { title } : {}) });
}
function replaceDisabled(name: string) {
	return name.replace("DISABLED_", "").replace("DISABLED", "").trim();
}
function formatDateTime() {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(
		2,
		"0"
	)}-${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(
		now.getSeconds()
	).padStart(2, "0")}`;
}
/**
 * Optimized sorting function using Intl.Collator for better performance
 * Handles case-insensitive sorting with uppercase precedence for same letters
 */
function sortMods(a: Mod | DirEntry, b: Mod | DirEntry) {
	const x = replaceDisabled(a.name);
	const y = replaceDisabled(b.name);

	// Use Intl.Collator for faster comparison
	const comparison = collator.compare(x, y);

	if (comparison !== 0) {
		return comparison;
	}

	// If names are equal after collation, prioritize uppercase
	const xFirstLower = x[0]?.toLowerCase();
	const yFirstLower = y[0]?.toLowerCase();

	if (xFirstLower === yFirstLower) {
		const xIsUpper = x[0] === x[0]?.toUpperCase();
		const yIsUpper = y[0] === y[0]?.toUpperCase();

		if (xIsUpper && !yIsUpper) return 1;
		if (!xIsUpper && yIsUpper) return -1;
	}

	return 0;
}
async function copyDir(src: string, dest: string, withProgress = false) {
	try {
		await mkdir(dest, { recursive: true });
		const entries = (await readDir(src)).filter(
			(item) =>
				!withProgress ||
				(item.name !== RESTORE && item.name !== IGNORE && item.name !== managedSRC && item.name !== managedTGT)
		);
		for (const entry of entries) {
			if (withProgress && canceled) {
				if (result == "Ok") result = "Operation Cancelled";
				return;
			}
			const srcPath = `${src}/${entry.name}`;
			const destPath = `${dest}/${entry.name}`;
			if (!entry.isDirectory) {
				await copyFile(srcPath, destPath);
				if (withProgress) {
					completedFiles++;
					if (progressBar && progressPerct && progressMessage) {
						const percentage = ((completedFiles / totalFiles) * 100).toFixed(2);
						progressBar.style.width = percentage + "%";
						progressPerct.innerText = percentage + "%";
						progressMessage.innerText = `${textMSG.file} ${completedFiles}/${totalFiles}: ${src.replace(
							rootReplace,
							""
						)}/${entry.name}`;
					}
				}
			} else {
				await copyDir(srcPath, destPath, withProgress);
			}
		}
	} catch (error) {
		canceled = true;
		result = "An Error Occurred";
		//console.error("Error copying directory:", error);
		throw error;
	}
}

async function countFilesInDir(path: string) {
	let entries = (await readDir(join(path, ""))).filter((item) => item.name != RESTORE && item.name != IGNORE);
	for (let entry of entries) {
		if (entry.isDirectory) {
			await countFilesInDir(join(path, entry.name));
		} else {
			totalFiles++;
			if (progressMessage) {
				progressMessage.innerText = textMSG.disc + " ( " + totalFiles + " / ? )";
			}
		}
	}
}
export function cancelRestore() {
	info("[IMM] Cancelling restore operation...");
	canceled = true;
}
export async function getRestorePoints(): Promise<string[]> {
	info("[IMM] Getting restore points...");
	try {
		const restoreDir = join(modRoot, RESTORE);
		if (!(await exists(restoreDir))) return [];
		const entries = await readDir(restoreDir);
		return entries
			.filter((item) => item.isDirectory)
			.map((item) => item.name)
			.sort()
			.reverse();
	} catch (error) {
		//console.error("Error getting restore points:", error);
		return [];
	}
}
export async function resetWithBackup() {
	info("[IMM] Resetting with backup...");
	const configs = ["", "WW", "ZZ", "GI"];
	for (let cfg of configs) {
		try {
			await rename(`config${cfg}.json`, `backups/MAN_${Date.now()}_config${cfg}.json.bak`);
		} catch {}
	}
	window.location.reload();
}
export async function previewRestorePoint(point: string) {
	info("[IMM] Previewing restore point:", point);
	let path = join(modRoot, RESTORE, point);
	if (!(await exists(path))) return [];
	let entries = await readDirRecr(path, "", 2);
	let categories = store.get(CATEGORIES) || [];
	//info(entries);
	return entries.map((entry: Mod) => {
		let category = categories.find((cat) => cat._sName == entry.name);
		if (category && entry.isDir) entry.icon = category._sIconUrl;
		return entry;
	});
}
export async function sourceBatchPreview(newCategory = "" as string) {
	info("[IMM] Previewing source batch...");
	let path = src;
	if (!(await exists(path))) return [];
	let categories = store.get(CATEGORIES) || [];
	try {
		if (newCategory) {
			await mkdir(join(modRoot, newCategory), { recursive: true });
		}
	} catch {}
	let entries = (await readDirRecr(path, "", 2)).map((entry: Mod) => {
		if (entry.name === managedSRC) {
			// entry.icon = "IMM2.png";

			entry.children.map((child: Mod) => {
				let category = categories.find((cat) => cat._sName == child.name);
				if (category && child.isDir) child.icon = category._sIconUrl;
				return child;
			});
		} else if (entry.name === managedTGT) {
			// entry.icon = "IMM2.png";
		}
		return entry;
	});
	info("[WWW]", entries);
	return entries;
}
export async function addToBatchPreview(opath: string) {
	info("[IMM] Adding to source batch preview:", opath);
	const path = join(src, opath);
	if (!(await exists(path))) return [];
	let entries = await readDirRecr(path, "", 0);
	info("[WWW]", path, " -> ", entries);
	return entries.map((entry: Mod) => {
		entry.path = join(opath, entry.path);
		entry.parent = opath;
		return entry;
	});
}
export async function restoreFromPoint(point: string) {
	info("[IMM] Restoring from point:", point);
	let path = join(modRoot, RESTORE, point);
	if (!(await exists(path))) return null;
	store.set(PROGRESS_OVERLAY, {
		title: "Restoring from " + name,
		finished: false,
		button: "Cancel",
		open: true,
		name: point,
	});
	progressBar = document.querySelector("#restore-progress");
	progressMessage = document.querySelector("#restore-progress-message");
	progressPerct = document.querySelector("#restore-progress-percentage");
	while (!progressBar || !progressMessage || !progressPerct) {
		await new Promise((resolve) => setTimeout(resolve, 10));
		progressBar = progressBar || document.querySelector("#restore-progress");
		progressMessage = progressMessage || document.querySelector("#restore-progress-message");
		progressPerct = progressPerct || document.querySelector("#restore-progress-percentage");
	}
	progressMessage.innerText = textMSG.rem;
	let entries = (await readDir(modRoot)).filter((item) => item.name != RESTORE);
	for (let entry of entries) {
		try {
			await remove(join(modRoot, entry.name), { recursive: true });
		} catch {}
	}
	progressMessage.innerText = textMSG.disc;
	completedFiles = 0;
	totalFiles = 0;
	canceled = false;
	if (canceled) {
		result = "Operation Cancelled";
	} else {
		await countFilesInDir(path);
		result = "Ok";
		rootReplace = join(modRoot, RESTORE, point);
		await copyDir(path, point.startsWith("ORG") ? src : modRoot, true);
	}
	store.set(PROGRESS_OVERLAY, (prev) => ({
		title: result == "Ok" ? "Restoration Completed" : result,
		finished: true,
		button: "Close",
		open: prev.open,
		name: point,
	}));
	return null;
}
export async function createRestorePoint(prefix = "") {
	info("[IMM] Creating restore point with prefix:", prefix);
	store.set(PROGRESS_OVERLAY, {
		title: "Creating Restore Point",
		button: "Cancel",
		finished: false,
		open: true,
		name: prefix,
	});
	progressBar = document.querySelector("#restore-progress");
	progressMessage = document.querySelector("#restore-progress-message");
	progressPerct = document.querySelector("#restore-progress-percentage");
	while (!progressBar || !progressMessage || !progressPerct) {
		await new Promise((resolve) => setTimeout(resolve, 10));
		progressBar = progressBar || document.querySelector("#restore-progress");
		progressMessage = progressMessage || document.querySelector("#restore-progress-message");
		progressPerct = progressPerct || document.querySelector("#restore-progress-percentage");
	}
	progressMessage.innerText = textMSG.disc;
	completedFiles = 0;
	totalFiles = 0;
	canceled = false;
	try {
		await mkdir(join(modRoot, RESTORE), { recursive: true });
	} catch (e) {}

	let restorePointName = prefix + "RESTORE-" + formatDateTime();
	const root = !prefix ? modRoot : src;
	rootReplace = root;
	await countFilesInDir(root);
	try {
		await mkdir(join(modRoot, RESTORE, restorePointName));
	} catch (e) {
		return null;
	}
	result = "Ok";
	await copyDir(root, join(modRoot, RESTORE, restorePointName), true);
	if (canceled) {
		if (result == "Ok") result = "Operation Cancelled";
		await remove(join(modRoot, RESTORE, restorePointName), { recursive: true });
		try {
			await remove(join(modRoot, RESTORE));
			await remove(join(modRoot));
		} catch (e) {}
	}
	store.set(PROGRESS_OVERLAY, (prev) => ({
		title: result == "Ok" ? "Restore Point Created" : result,
		button: "Close",
		finished: true,
		open: prev.open,
		name: prefix,
	}));
	return null;
}
export async function checkOldVerDirs(src: string) {
	try {
		let checkFolders = 0;
		const entries = await readDir(src);
		for (const i of entries) {
			if (i.isDirectory && sp.includes(i.name)) {
				checkFolders++;
			}
		}
		return checkFolders === 3;
	} catch (error) {
		//console.error("Error checking old version directories:", error);
		return false;
	}
}
export async function categorizeDir(src: string, modifyIni = false) {
	info("[IMM] Categorizing directory:", src, "Skip restore:", modifyIni);
	const d3dx_path = join(...tgt.split("\\").slice(0, -1), "d3dx_user.ini");
	let d3dx = "" as any;
	try {
		info("[IMM] Reading d3dx_user.ini...", await exists(d3dx_path));
		if (modifyIni) d3dx = await readTextFile(d3dx_path);
	} catch {
		info("[IMM] d3dx_user.ini not found or could not be read.");
	}
	try {
		const categories = [...store.get(CATEGORIES), { _sName: UNCATEGORIZED }].map((cat) => cat._sName);
		const reqCategories: Record<string, Array<{ name: string; isDirectory: boolean }>> = {};
		const entries = await readDir(src);
		const ignore = [IGNORE, managedSRC, managedTGT, RESTORE];

		// First pass: categorize items
		for (const item of entries) {
			if (item.isDirectory && ignore.includes(item.name)) continue;
			if (item.name === OLD_RESTORE) {
				if (modifyIni) continue;
				try {
					await rename(join(src, OLD_RESTORE), join(src, RESTORE));
				} catch (error) {
					//console.error("Error renaming OLD_RESTORE:", error);
				}
				continue;
			}
			if (categories.includes(item.name)) {
				continue;
			}
			const category =
				categories.find((cat: string) =>
					cat
						.toLowerCase()
						.split(" ")
						.some(
							(catPart: string) =>
								catPart.includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(catPart)
						)
				) || UNCATEGORIZED;
			if (item.isDirectory && item.name === category) continue;

			if (!reqCategories[category]) {
				reqCategories[category] = [];
			}
			reqCategories[category].push({ name: item.name, isDirectory: item.isDirectory });
		}
		// Second pass: batch create directories and move items
		const mkdirPromises: Promise<void>[] = [];
		for (const key of Object.keys(reqCategories)) {
			mkdirPromises.push(mkdir(join(src, key), { recursive: true }));
		}
		await Promise.all(mkdirPromises);

		// Move items to categories
		const renamePromises: Promise<void>[] = [];
		const changesToD3dx: Record<string, string> = {};
		for (const [key, list] of Object.entries(reqCategories)) {
			for (const item of list) {
				const oldPath = join(src, item.name);
				const newPath = join(src, key, replaceDisabled(item.name));
				renamePromises.push(
					rename(oldPath, newPath).then(() => {
						changesToD3dx[oldPath] = newPath;
					})
				);
			}
		}
		await Promise.all(renamePromises);
		if (modifyIni && d3dx) {
			d3dx = d3dx.split("\n");
			for (const [oldPath, newPath] of Object.entries(changesToD3dx)) {
				const op = join("$\\mods", oldPath.replaceAll(tgt, "").replaceAll("/", "\\")).toLowerCase();
				const np = join("$\\mods\\", managedTGT, newPath.replaceAll(tgt, "").replaceAll("/", "\\")).toLowerCase();
				info("[IMM] Updating d3dx_user.ini:", op, "->", np);
				d3dx = d3dx.map((line: string) => (line.startsWith(op) ? line.replace(op, np) : line));
			}
			await writeTextFile(d3dx_path, d3dx.join("\n"));
		}
	} catch (error) {
		//console.error("Error categorizing directory:", error);
		throw error;
	}
}
export async function verifyDirStruct() {
	const status: ChangeInfo = {
		before: [],
		after: [],
		map: {},
		title: "Confirm Changes",
		skip: false,
	};
	try {
		if (!(!!src && (await exists(src))) || !(!!tgt && (await exists(tgt))))
			throw new Error("Source or Target not found: " + src + " | " + tgt);

		if (!(await exists(tgt))) throw new Error("Target Directory not found: " + tgt);
		try {
			const oldTgtPath = join(tgt, OLD_managedTGT);
			const newTgtPath = join(tgt, managedTGT);
			if (await exists(oldTgtPath)) {
				await rename(oldTgtPath, newTgtPath);
				//add code to read the file d3dx_user.ini in the parent folder of oldTgtPath, and replace all instances of OLD_managedTGT with managedTGT
				const parentDir = tgt.split("\\").slice(0, -1).join("\\");
				const iniPath = join(parentDir, "d3dx_user.ini");
				info("[IMM] Updating d3dx_user.ini at:", iniPath);

				try {
					if (await exists(iniPath)) {
						let iniContent = await readTextFile(iniPath);
						const updatedContent = iniContent.split(OLD_managedTGT.toLowerCase()).join(managedTGT.toLowerCase());
						await writeTextFile(iniPath, updatedContent);
					}
				} catch (e) {
					error("Error updating d3dx_user.ini:", e);
				}
			}
			const oldSrcPath = join(src, OLD_managedSRC);
			const newSrcPath = join(src, managedSRC);
			if (await exists(oldSrcPath)) {
				await rename(oldSrcPath, newSrcPath);
				const targetEntries = (await readDirRecr(newTgtPath, "", 2)).flatMap((x) => x.children || []);
				info("[IMM] Fixing symlinks in target directory. Broken: ", targetEntries);
				for (const entry of targetEntries) {
					const linkPath = join(newTgtPath, entry.path);
					await remove(linkPath);
					await mkdir(join(newTgtPath, entry.parent), { recursive: true });
					try {
						await invoke("create_symlink", {
							linkPath: linkPath,
							targetPath: join(newSrcPath, entry.path),
						});
						info("[IMM] Fixed symlink:", linkPath, "->", join(newSrcPath, entry.path));
					} catch (err) {
						error("[IMM] Error creating symlink:", err);
					}
				}
			}
		} catch (e: any) {
			if (e.startsWith("failed to rename old path")) {
				store.set(ERR, textData["v2.1.2Warning"]);
			} else {
				store.set(ERR, e.toString());
			}
		}
		const modDir = join(src, managedSRC);
		const [modDirExists, isOldVersion] = await Promise.all([exists(modDir), checkOldVerDirs(src)]);

		if (modDirExists) {
			await categorizeDir(modDir);
			status.skip = true;
		}
		if (isOldVersion) {
			await applyChanges(true);
			status.skip = true;
		}
		if (status.skip) throw new Error("Migration done, please verify the directories again");
		const categories: Category[] = [
			...store.get(CATEGORIES),
			{ _sName: UNCATEGORIZED, _sIconUrl: "", _idRow: 0, _nItemCount: 0, _nCategoryCount: 0, _sUrl: "" },
		];
		const reqCategories: Record<string, DirEntry> = {};

		const srcEntries = await readDir(src);
		if (srcEntries.length === 0) {
			status.skip = true;
			await mkdir(modDir, { recursive: true });
			throw new Error("Source directory is empty");
		}
		status.before = srcEntries
			.map((item) => ({
				name: item.name,
				isDirectory: item.isDirectory,
				children: [],
			}))
			.sort(sortMods)
			.filter((item) => item.name !== IGNORE || !item.isDirectory);

		const before = [...status.before].filter(
			(item) => item.isDirectory && item.name !== IGNORE && item.name !== managedTGT && item.name !== managedSRC
		);
		status.after = [
			{
				name: managedSRC,
				isDirectory: true,
				children: [],
			},
		];

		// Batch read directories for items that need it
		const readPromises: Promise<{ item: any; entries: any[] }>[] = [];
		for (const item of before) {
			const category =
				categories.find(
					(cat: Category) =>
						cat._sName === item.name ||
						(!categories.some((c) => c._sName === item.name) &&
							cat._sName
								.toLowerCase()
								.split(" ")
								.some(
									(catPart: string) =>
										catPart.includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(catPart)
								))
				) ||
				(item.name === RESTORE || item.name === OLD_RESTORE
					? { _sName: RESTORE, _sIconUrl: "" }
					: { _sName: UNCATEGORIZED, _sIconUrl: "" });

			if ((item.isDirectory && item.name === category._sName) || item.name === OLD_RESTORE) {
				readPromises.push(
					readDir(join(src, item.name))
						.then((entries) => ({ item, entries, category }))
						.catch(() => {
							//console.error(`Error reading directory ${item.name}:`, error);
							return { item, entries: [], category };
						})
				);
			} else {
				// Add item directly without reading
				if (!reqCategories[category._sName]) {
					reqCategories[category._sName] = {
						name: category._sName,
						icon: category._sIconUrl,
						isDirectory: true,
						children: [],
					};
				}
				reqCategories[category._sName].children?.push({ name: item.name, isDirectory: item.isDirectory });
			}
		}

		// Process all read operations in parallel
		const readResults = await Promise.all(readPromises);
		for (const { entries, category } of readResults as any) {
			if (!reqCategories[category._sName]) {
				reqCategories[category._sName] = {
					name: category._sName,
					icon: category._sIconUrl,
					isDirectory: true,
					children: [],
				};
			}
			reqCategories[category._sName].children?.push(
				...entries.map((i: DirEntry) => ({ name: i.name, isDirectory: i.isDirectory }))
			);
		}
		status.map = { ...reqCategories };
		status.skip = Object.keys(reqCategories).length === 0;
		if (status.skip) throw new Error("No categories found, please verify the directories again");

		// Process modDir if it exists
		if (modDirExists) {
			try {
				const modDirEntries = await readDir(modDir);
				const modDirReadPromises: Promise<{ category: any; entries: DirEntry[] }>[] = [];

				for (const item of modDirEntries) {
					if (!item.isDirectory) continue;

					const category =
						item.name === RESTORE
							? { _sName: RESTORE, _sIconUrl: "" }
							: categories.find(
									(cat) =>
										cat._sName === item.name ||
										(!categories.some((c) => c._sName === item.name) &&
											cat._sName
												.toLowerCase()
												.split(" ")
												.some(
													(catPart: string) =>
														catPart.includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(catPart)
												))
								);

					if (category) {
						modDirReadPromises.push(
							readDir(join(modDir, item.name))
								.then((entries) => ({ category, entries }))
								.catch(() => {
									//console.error(`Error reading modDir category ${item.name}:`, error);
									return { category, entries: [] };
								})
						);
					}
				}

				const modDirResults = await Promise.all(modDirReadPromises);
				for (const { category, entries } of modDirResults) {
					if (!reqCategories[category._sName]) {
						reqCategories[category._sName] = {
							name: category._sName,
							icon: category._sIconUrl || "",
							isDirectory: true,
							children: [],
						};
					}
					reqCategories[category._sName].children?.push(
						...entries.map((i) => ({ name: i.name, isDirectory: i.isDirectory }))
					);
				}
			} catch (error) {
				//console.error("Error processing modDir:", error);
			}
		}
		for (const key of Object.keys(reqCategories)) {
			status.after[0].children?.push({
				...reqCategories[key],
				children: (reqCategories[key].children as DirEntry[]).sort(sortMods),
			});
		}
		status.after[0].children?.sort(sortMods);
		status.after.sort(sortMods);
	} catch (e) {
		info("[ERR] ", e);
	} finally {
		info("[IMM] Directory structure verified:", status);
		return status;
	}
}
export async function createManagedDir() {
	info("[IMM] Creating managed directories...");
	try {
		if (!src) return false;
		await mkdir(join(src, managedSRC), { recursive: true });
		if (!tgt) return false;
		await mkdir(join(tgt, managedTGT), { recursive: true });
		return true;
	} catch (err) {
		error("[IMM] Error creating managed directories:", err);
		throw err;
	}
}
export async function applyChanges(isMigration = false) {
	info("[IMM] Applying changes, isMigration:", isMigration);
	try {
		if (!src || !tgt) return false;

		let map: Record<string, DirEntry> = {};
		info("[IMM] Verifying directory structure before applying changes...");
		const target = join(tgt, managedTGT);
		if (!target) return true;
		info("[IMM] Target exists, creating managed directories...");
		await mkdir(join(src, managedSRC), { recursive: true });
		await mkdir(join(tgt, managedTGT), { recursive: true });
		await categorizeDir(src, true);

		const entries = true ? (await readDir(src)).map((item) => item.name) : Object.keys(map);

		info("[IMM] Processing entries:", entries);
		// Batch process entries
		for (const key of entries) {
			if (key === IGNORE || key === managedSRC || key === managedTGT) continue;

			if (key === RESTORE || key === OLD_RESTORE) {
				try {
					await rename(join(src, OLD_RESTORE), join(src, managedSRC, RESTORE));
				} catch (e) {
					try {
						await copyDir(join(src, RESTORE), join(src, managedSRC, RESTORE));
					} catch (e) {
						//console.error(`Error handling RESTORE directory:`, e);
					}
				}
				continue;
			}

			try {
				info(`[IMM] Renaming ${key} to managedSRC...`);
				await rename(join(src, key), join(src, managedSRC, key));
			} catch (err) {
				error(`Error renaming ${key}:`, err);
				continue;
			}

			await mkdir(join(target, key), { recursive: true });

			const dirEntries = (true ? await readDir(join(src, managedSRC, key)) : map[key].children) || [];
			// Batch process directory entries
			const itemOperations: Promise<void>[] = [];
			for (const item of dirEntries) {
				const isDisabled = item.name.startsWith("DISABLED");
				const name = replaceDisabled(item.name);
				if (isDisabled) {
					itemOperations.push(
						rename(join(src, managedSRC, key, item.name), join(src, managedSRC, key, name)).catch(() => {
							//console.error(`Error renaming disabled item ${item.name}:`, error);
						})
					);
				} else {
					itemOperations.push(
						invoke<void>("create_symlink", {
							linkPath: join(target, key, name),
							targetPath: join(src, managedSRC, key, name),
						}).catch(() => {
							//console.error(`Error creating symlink for ${name}:`, error);
						}) as Promise<void>
					);
				}
			}
			await Promise.all(itemOperations);
		}
		return true;
	} catch (err) {
		error("[IMM] Error applying changes:", err);
		throw err;
	}
}
async function readDirRecr(root: string, path: string, maxDepth = 2, depth = 0, def = true): Promise<Mod[]> {
	if (depth > maxDepth) return [];
	let entries: DirEntry[] = [];
	try {
		entries = await readDir(join(root, path));
	} catch {
		return [];
	}
	const filePromises = entries.map(async (entry) => {
		if ((entry.name == RESTORE || entry.name == IGNORE) && def && depth == 0) return null;
		let children: Mod[] = [];
		if (entry.isDirectory) children = await readDirRecr(root, join(path, entry.name), maxDepth, depth + 1);
		return {
			isDir: entry.isDirectory,
			name: entry.name,
			parent: join(path),
			path: join(path, entry.name),
			keys: [],
			enabled: false,
			children,
			depth,
		};
	});
	const files = (await Promise.all(filePromises)).filter((file) => file !== null) as Mod[];
	return files.sort(sortMods);
}
async function detectHotkeys(
	entries: Mod[],
	data: ModDataObj,
	src: string,
	depth = 0,
): Promise<[Mod[], any, ModHotKeys[]]> {
	const entryPromises = entries.map(async (entry) => {
		let hkData: ModHotKeys[] = [];
		let hashes = new Set() as any;
		try {
			// Apply stored data to entry
			if (data[entry.path]) {
				for (const key of Object.keys(data[entry.path])) {
					// @ts-ignore
					entry[key as "source" | "updatedAt" | "note"] =
						data[entry.path as keyof typeof data][key as "source" | "updatedAt" | "note"] ||
						(key === "updatedAt" ? 0 : "");
				}
			}

			// Parse .ini files for hotkeys
			if (entry.name.endsWith(".ini")) {
				try {
					const file = await readTextFile(join(src, entry.path));
					const lines = file.split("\n");
					let counter = 0;
					let key = "";
					let type = "";
					let target = "";
					let values = "";
					let tempKey = "";
					let tempVal = "";
					let section = "";
					let vars: Record<string, any> = {};
					let fileData: ModHotKeys[] = [];
					for (let line of lines) {
						let ln = line
							.trim()
							.replaceAll(/[\r\n]+/g, "")
							.replaceAll(" ", "");
						if (ln.startsWith("[") && ln.endsWith("]")) {
							section = ln.slice(1, -1).toLowerCase();
						}
						if (section === "constants" && ln.includes("$") && ln.includes("=")) {
							try {
								[tempKey, tempVal] = ln
									.split("$")[1]
									.split("=")
									.map((part) => part.trim());
								if (!vars.hasOwnProperty(tempKey)) vars[tempKey] = tempVal;
							} catch {}
						}
						if(ln.startsWith("hash=")){
							const val = line.split("=")[1]?.trim() || "";
							hashes.add(val);
						}
						if (counter === 0 && ln.startsWith("key=")) {
							key =
								line
									.split("=")[1]
									?.trim()
									.split(" ")
									.map((k) => {
										k = k.toLowerCase();
										if (k.startsWith("no_")) k = "";
										else {
											k = k.replace("vk_", "");
										}
										return k.trim();
									})
									.filter((k) => k)
									.join("+") || "";
							counter++;
						} else if (counter === 1 && ln.startsWith("type=")) {
							type = line.split("=")[1]?.trim() || "";
							counter++;
						} else if (counter === 2 && ln.startsWith("$")) {
							[target, values] = line.split("=").map((part) => part.trim());
							target = target?.slice(1) || "";
							counter = 0;
							fileData.push({
								key,
								type,
								target,
								file: entry.path.split("\\").slice(2).join("\\").toLowerCase(),
								name: target,
								values: values.split(",").map((v) => v.trim()) || "",
								default: "",
								pref: null,
								reset: null,
							});
						}
					}
					hkData.push(
						...fileData.map((hk) => {
							hk.default = vars[hk.target] || "";
							return hk;
						})
					);
				} catch (iniError) {
					//console.error(`Error parsing .ini file ${entry.name}:`, iniError);
				}
			}

			// Recursively process children
			if (entry.isDir && entry.children.length > 0) {
				const [updatedChildren, childHashes, childHK] = await detectHotkeys(entry.children, data, src, depth + 1);
				hashes = new Set([...Array.from(hashes), ...Array.from(childHashes)]);
				entry.children = updatedChildren;
				if (childHK.length > 0 && depth > 0) {
					hkData = [...hkData, ...childHK];
				}
			}
			if (depth == 1) {
				entry.keys = hkData;
			}
			if (depth == 1) {
				entry.hashes = Array.from(hashes);
			}
		} catch (entryError) {
			//console.error(`Error processing entry ${entry.name}:`, entryError);
		}
		return { entry, hkData, hashes };
	});

	const results = await Promise.all(entryPromises);
	const processedEntries = results.map((r) => r.entry);
	const hotkeyData = depth < 2 ? [] : results.flatMap((r) => r.hkData);
	const hashes = new Set<string>(results.flatMap((r) => Array.from(r.hashes)));
	return [processedEntries, hashes, hotkeyData];
}
export async function refreshModList() {
	info("[IMM] Refreshing mod list...");
	let before = Date.now();
	try {
		const data = store.get(DATA);
		const modSrc = join(src, managedSRC);
		const modTgt = join(tgt, managedTGT);

		await categorizeDir(modSrc);

		const ret = await detectHotkeys(await readDirRecr(modSrc, "", 3), data, modSrc);
		info("Hashes detected:", ret[1]);
		const entries = ret[0]
			.map((entry) => entry.children)
			.flat()
			.map((entry) => {
				if (entry.depth == 1) entry.children = [];
				return entry;
			})
			.filter((entry) => entry.depth < 2)
			.sort(sortMods);
		
		// Batch process entries - separate rename operations from exists checks
		const renameOperations: Promise<void>[] = [];
		const existsChecks: Promise<{ entry: Mod; enabled: boolean }>[] = [];

		for (const entry of entries) {
			if (entry.name.startsWith("DISABLED")) {
				const newName = replaceDisabled(entry.name);
				const newPath = join(entry.parent, newName);

				renameOperations.push(
					rename(join(modSrc, entry.path), join(modSrc, newPath))
						.then(() => {
							entry.name = newName;
							entry.path = newPath;
						})
						.catch(() => {
							//console.error(`Error renaming ${entry.name}:`, error);
						})
				);
			}

			existsChecks.push(
				exists(join(modTgt, entry.path))
					.then((enabled) => ({ entry, enabled }))
					.catch(() => ({ entry, enabled: false }))
			);
		}

		// Wait for all renames to complete first
		await Promise.all(renameOperations);

		// Then process exists checks
		const existsResults = await Promise.all(existsChecks);
		for (const { entry, enabled } of existsResults) {
			entry.enabled = enabled;
		}
		//info(recentlyDownloaded);
		info("[IMM] Mod list refreshed:", entries);
		info("[IMM] Mod list refresh took", Date.now() - before, "ms");
		return entries
			.filter((entry) => recentlyDownloaded.includes(entry.path))
			.concat(entries.filter((entry) => !recentlyDownloaded.includes(entry.path)));
	} catch (err) {
		error("[IMM] Error refreshing mod list:", err);
		throw err;
	}
}
export async function createModDownloadDir(cat: string, dir: string) {
	try {
		if (!cat || !dir) return;
		const path = join(src, managedSRC, cat, dir);
		if (await exists(path)) return path;
		await mkdir(path, { recursive: true });
		return path;
	} catch (err) {
		error("[IMM] Error creating mod download directory:", err);
		throw err;
	}
}
export async function validateModDownload(path: string, skip = false) {
	try {
		const entries = await readDir(path);
		const previewCount = entries.filter((entry) => entry.name.startsWith("preview.") && !entry.isDirectory).length;

		if (entries.length - previewCount === 1) {
			let hasIni = false;
			const dirs: string[] = [];

			for (const entry of entries) {
				if (entry.name.endsWith(".ini")) hasIni = true;
				if (entry.isDirectory) dirs.push(entry.name);
			}

			if (!hasIni && dirs.length === 1) {
				const uuid = "IMM_TEMP_" + Math.floor(Math.random() * 1000000000);
				const tempPath = path + "\\" + uuid;
				const dirPath = path + "\\" + dirs[0];

				try {
					await rename(dirPath, tempPath);
					await copyDir(tempPath, path);
					await remove(tempPath, { recursive: true });
				} catch (err) {
					error("[IMM] Error flattening mod directory structure:", err);
				}
			}
		}
		if (!skip) {
			const list = store.get(MOD_LIST);
			const relPath = path.split(managedSRC + "\\")[1];
			info("[IMM] Validating mod download for path:", relPath);
			const ele = list.find((mod) => mod.path === relPath);
			if (ele) {
				const keys = ele.keys || [];
				const files = {} as any;
				for (const hk of keys) {
					if (!files[hk.file]) files[hk.file] = {};
					if (hk.default) files[hk.file][hk.target] = hk.default;
				}
				const promises = [] as Promise<any>[];
				Object.keys(files).forEach((file) => {
					if (Object.keys(files[file]).length > 0) {
						promises.push(updateIniVars(join(relPath, file), files[file]));
					}
				});
				await Promise.all(promises);
			}
			const downloads = store.get(DOWNLOAD_LIST);
			const completed = downloads.completed.length + 1;
			const total = completed + downloads.queue.length + 1;
			addToast({ type: "success", message: `${textData._Toasts.DownloadComplete} (${completed}/${total})` });
		}
	} catch (err) {
		if (!skip)  addToast({ type: "error", message: textData._Toasts.ErrDownload });
		error("[IMM] Error validating mod download:", err);
	}
	return true;
}
export async function cleanCancelledDownload(path: string) {
	try {
		if (!(await exists(path))) return;
		const entries = await readDir(path);
		const hasPreview = entries.filter((entry) => entry.name.startsWith("preview.") && !entry.isDirectory).length;
		const hasArchive = entries.filter(
			(entry) => entry.name.endsWith(".zip") || entry.name.endsWith(".rar") || entry.name.endsWith(".7z")
		).length;
		if (entries.length === hasPreview + hasArchive && hasArchive <= 1 && hasPreview <= 1) {
			await remove(path, { recursive: true });
		}
	} catch (err) {
		error('[IMM] Error cleaning cancelled download:', err);
	}
}
export async function changeModName(path: string, newPath: string, add = false) {
	try {
		const enabled = add || (await toggleMod(path, false));
		await mkdir(join(src, managedSRC, ...newPath.split("\\").slice(0, -1)), { recursive: true });
		await rename(add ? join(src, path) : join(src, managedSRC, path), join(src, managedSRC, newPath));
		store.set(DATA, (prev) => {
			if (prev[path]) {
				prev[newPath] = { ...prev[path] };
				delete prev[path];
			}
			return prev;
		});
		store.set(PRESETS, (prev) => {
			for (let i = 0; i < prev.length; i++) {
				if (prev[i].data.includes(path)) {
					prev[i].data = prev[i].data.filter((p) => p !== path);
					prev[i].data.push(newPath);
				}
			}
			return prev;
		});
		saveConfigs();
		await updateD3DXIniFromData(newPath);
		if (enabled) await toggleMod(newPath, true);
		return newPath;
	} catch (err) {
		error("[IMM] Error changing mod name:", err);
		throw err;
	}
}
export async function deleteCategory(cat: string) {
	const path = join(src, managedSRC, cat);
	if (!(await exists(path))) return true;
	try {
		await remove(path);
		return true;
	} catch (err) {
		error("[IMM] Error deleting category:", err);
		return false;
	}
}
export async function deleteRestorePoint(point: string) {
	try {
		const path = join(modRoot, RESTORE, point);
		await remove(path, { recursive: true });
		addToast({ type: "success", message: textData._Toasts.Deleted });
		return true;
	} catch (err) {
		error("[IMM] Error deleting restore point:", err);
		addToast({ type: "error", message: textData._Toasts.ErrOcc });
		return false;
	}
}
export async function deleteMod(path: string) {
	const modSrc = join(src, managedSRC, path);
	const modTgt = join(tgt, managedTGT, path);

	try {
		await remove(modTgt);
	} catch (err) {
		error("[IMM] Error removing mod target:", err);
	}

	try {
		await remove(modSrc, { recursive: true });
		addToast({ type: "success", message: textData._Toasts.Deleted });
	} catch (err) {
		error("[IMM] Error removing mod source:", err);
		addToast({ type: "error", message: textData._Toasts.ErrOcc });
		throw error;
	}
}
async function updateDataFromD3DXIni(modPath: string) {
	const root = join(...tgt.split("\\").slice(0, -1), "d3dx_user.ini");
	const data = store.get(DATA);
	const modData: Record<string, Record<string, any>> = data[modPath]?.vars || {};
	if (!(await exists(root))) return;
	const lines = (await readTextFile(root)).split("\n");
	// const data: Record<string, Record<string, any>> =
	for (let line of lines) {
		if (!line.includes(modPath.toLowerCase() + "\\")) continue;
		const split = line.trim().split("=");
		const [KeyVar, Val] = [split[0].split(modPath.toLowerCase() + "\\")[1].split("\\"), split[1]];
		const Var = (KeyVar.pop() || "").toLowerCase().trim();
		const Key = KeyVar.join("\\");
		if (Key && Var && Val) {
			if (!modData.hasOwnProperty(Key)) modData[Key] = {};
			if (!modData[Key].hasOwnProperty(Var)) modData[Key][Var] = {};
			modData[Key.trim()][Var.toLowerCase().trim()].state = Val.trim();
		}
	}
	if (modData && Object.keys(modData).length > 0) {
		store.set(DATA, (prev) => {
			prev[modPath] = {
				...prev[modPath],
				vars: modData,
			};
			return { ...prev };
		});
		saveConfigs();
	}
	info("[IMM] Updating data from ini for mod data:", data);
}
async function updateD3DXIniFromData(modPath: string) {
	const data = store.get(DATA)[modPath];
	if (!data || !data.vars) return;
	const root = join(...tgt.split("\\").slice(0, -1), "d3dx_user.ini");
	if (!(await exists(root))) return;
	const lines = (await readTextFile(root)).split("\n").filter((l) => !l.includes(modPath.toLowerCase() + "\\"));
	for (let key of Object.keys(data.vars)) {
		for (let Var of Object.keys(data.vars[key])) {
			const x = data.vars[key][Var.toLowerCase()];
			const line = `$\\mods\\${managedTGT}\\${modPath.toLowerCase()}\\${key}\\${Var} = ${x.pref ?? x.state}`;
			lines.push(line);
			info(`[IMM] Updating Mod: ${modPath} | File: ${key} | Added Line: ${line}`);
		}
	}
	await writeTextFile(root, lines.join("\n"));
}
export async function updateIniVars(relPath: string, keyVals: Record<string, string>) {
	const path = join(modRoot, relPath);
	const file = await readTextFile(path);
	const lines = file.split("\n");
	try {
		let section = "";
		for (let i = 0; i < lines.length; i++) {
			let ln = lines[i]
				.trim()
				.replaceAll(/[\r\n]+/g, "")
				.replaceAll(" ", "");
			if (ln.startsWith("[") && ln.endsWith("]")) {
				section = ln.slice(1, -1).toLowerCase();
			}
			if (section === "constants" && ln.includes("$") && ln.includes("=")) {
				const modKey = ln.split("$")[1].split("=")[0].trim().toLowerCase();
				if (keyVals.hasOwnProperty(modKey)) {
					lines[i] = `${lines[i].split("=")[0]}= ${keyVals[modKey]}`;
					info(`[IMM] Updating Mod: ${path} | Line${i}: ${lines[i]}`);
				}
				delete keyVals[modKey];
				if (Object.keys(keyVals).length === 0) break;
			}
		}
	} catch {
		return false;
	}
	await writeTextFile(path, lines.join("\n"));
	return true;
}
export function openFile(relPath: string) {
	openPath(join(modRoot, relPath));
}
export async function toggleMod(path: string, enabled: boolean) {
	info("[IMM] Toggling mod:", path, "Enabled:", enabled);
	try {
		const modSrc = join(src, managedSRC, path);
		const modTgt = join(tgt, managedTGT, path);

		if (enabled) {
			const [srcExists, tgtExists] = await Promise.all([exists(modSrc), exists(modTgt)]);
			if (srcExists && !tgtExists) {
				await updateD3DXIniFromData(path);
				await mkdir(join(tgt, managedTGT, ...path.split("\\").slice(0, -1)), { recursive: true });
				try {
					await invoke("create_symlink", {
						linkPath: modTgt,
						targetPath: modSrc,
					});
				} catch (err) {
					error('[IMM] Error creating symlink:', err);
					return false;
				}
			}
		} else {
			await updateDataFromD3DXIni(path);
			try {
				await remove(modTgt);
			} catch (err) {
				error('[IMM] Error removing mod:', err);
				return false;
			}
		}
		return true;
	} catch (err) {
		error('[IMM] Error toggling mod:', err);
		return false;
	}
}
export async function savePreviewImage(path: string) {
	try {
		path = join(src, managedSRC, path);
		const file = await open({
			multiple: false,
			directory: false,
			filters: [{ name: "Image", extensions: ["png", "jpg", "jpeg", "webp", "gif"] }],
		});

		if (!file) return;

		// Remove existing preview images in parallel
		const exts = ["png", "jpg", "jpeg", "webp", "gif"];
		const removePromises = exts.map((ext) =>
			remove(path + "\\" + "preview." + ext).catch(() => {
				// Ignore errors if file doesn't exist
			})
		);
		await Promise.all(removePromises);

		// Copy new preview image
		const fileExt = file.split(".").pop();
		await copyFile(file, path + "\\" + "preview." + fileExt);
		store.set(LAST_UPDATED, Date.now());
		addToast({ type: "success", message: textData._Toasts.ImgSaved });
	} catch (err) {
		//console.error("Error saving preview image:", error);
		addToast({ type: "error", message: textData._Toasts.ErrOcc });
		throw error;
	}
}
export async function applyPreset(data: string[], name = "") {
	try {
		const entries = (await readDirRecr(join(tgt, managedTGT), "", 2)).flatMap((x) => x.children || []);
		const disablePromises: Promise<boolean>[] = entries.map((entry) => toggleMod(entry.path, false));
		await Promise.all(disablePromises);
		await remove(join(tgt, managedTGT), { recursive: true });
		await mkdir(join(tgt, managedTGT), { recursive: true });

		// Apply mods in parallel batches to improve performance
		const batchSize = 10;
		for (let i = 0; i < data.length; i += batchSize) {
			const batch = data.slice(i, i + batchSize);
			await Promise.all(
				batch.map((mod) =>
					toggleMod(mod, true).catch((err = "unknown") => {
						error(`[IMM] Error toggling mod ${mod}:`, err);
					})
				)
			);
		}
		if (name) {
			addToast({ type: "success", message: textData._Toasts.PresetApplied });
		}
	} catch (err) {
		error('[IMM] Error applying preset:', err);
		if (name) addToast({ type: "error", message: textData._Toasts.ErrOcc });
		throw error;
	}
}

export async function installFromArchives(archives: string[]) {
	// const categories = store.get(CATEGORIES).map((cat) => cat._sName);
	let success = 0;
	async function extractArchive(archive: string) {
		if (!archive) return;
		const [name, ext] = archive.split("\\").pop()!.split(".");
		const root = join(src, managedSRC, UNCATEGORIZED);
		await mkdir(root, { recursive: true });
		let counter = 0;
		let finalName = name;
		while (await exists(join(root, finalName))) {
			finalName = `${name} (${++counter})`;
		}
		const dest = join(root, finalName);
		await mkdir(dest, { recursive: true });
		try {
			info("[IMM] Extracting archive:", archive, "to", dest);
			await invoke("extract_archive", { filePath: archive, savePath: dest, fileName: name, ext, del: false });
			info("[IMM] Archive extracted:", archive);
			await validateModDownload(dest, true);
			success++;
		} catch (err) {
			error('[IMM] Error extracting archive:', err);
			addToast({ type: "error", message: `Error installing ${name}` });
		}
	}
	const extractPromises = archives.map((archive) => extractArchive(archive));
	await Promise.all(extractPromises);
	addToast({ type: "success", message: `${success}/${archives.length} mod(s) installed successfully.` });
}
