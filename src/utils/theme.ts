import { Games } from "./types";
import { LANG, store } from "./vars";

type GameTheme = "wuwa" | "zzz";
export type Language = "en" | "cn" | "jp" | "kr" | "ru";
function gameToTheme(game: Games): GameTheme {
	return ({ WW: "wuwa", ZZ: "zzz", GI: "gi", "": "", }[game] || "wuwa") as GameTheme;
}
function themeToGame(theme: GameTheme): Games {
	return ({ wuwa: "WW", zzz: "ZZ", gi: "GI", "": "" }[theme] || "WW") as Games;
}

/**
 * Switch between WuWa and ZZZ themes
 * @param theme - The theme to switch to ('wuwa' or 'zzz')
 */
// let interval = null as any;
export function switchGameTheme(theme: Games): void {
	const root = document.documentElement;

	// Remove any existing theme data attribute
	root.removeAttribute("data-theme");

	// Set the new theme
	root.setAttribute("data-theme", gameToTheme(theme));

	// Optional: Store theme preference in localStorage
	localStorage.setItem("game-theme", gameToTheme(theme));

	//info(`Switched to ${theme.toUpperCase()} theme`);
}

/**
 * Switch language and update data attribute
 * @param language - The language to switch to ('en' | 'cn' | 'jp' | 'kr' | 'ru')
 */
export function switchLanguage(language: Language): void {
	const root = document.documentElement;

	// Set the language data attribute
	root.setAttribute("data-lang", language);

	// Store language preference in localStorage
	localStorage.setItem("app-language", language);

	//info(`Switched to ${language.toUpperCase()} language`);
}

store.sub(LANG,()=>{
	switchLanguage(store.get(LANG) as Language);
})

/**
 * Get the current active theme
 * @returns The current theme ('wuwa' or 'zzz')
 */
export function getCurrentTheme(): GameTheme {
	const root = document.documentElement;
	const currentTheme = root.getAttribute("data-theme") as GameTheme;

	// Default to 'wuwa' if no theme is set
	return currentTheme || "wuwa";
}

/**
 * Get the current active language
 * @returns The current language ('en' | 'cn' | 'jp' | 'kr' | 'ru')
 */
export function getCurrentLanguage(): Language {
	const root = document.documentElement;
	const currentLang = root.getAttribute("data-lang") as Language;

	// Default to 'en' if no language is set
	return currentLang || "en";
}

/**
 * Initialize theme from localStorage or default to WuWa
 */
export function initializeThemes(): void {
	const savedTheme = localStorage.getItem("game-theme") as GameTheme;
	const themeToUse = savedTheme || "wuwa";
	switchGameTheme(themeToGame(themeToUse));
	initializeLanguage();
}

/**
 * Initialize language from localStorage or default to English
 */
export function initializeLanguage(): void {
	const savedLanguage = localStorage.getItem("app-language") as Language;
	const languageToUse = savedLanguage || "en";
	switchLanguage(languageToUse);
}

/**
 * Toggle between WuWa and ZZZ themes
 */
export function toggleGameTheme(): void {
	const currentTheme = getCurrentTheme();
	const newTheme: GameTheme = currentTheme === "wuwa" ? "zzz" : "wuwa";

	switchGameTheme(themeToGame(newTheme));
}
