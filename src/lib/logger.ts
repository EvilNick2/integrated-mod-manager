import { error as traceError, info as traceInfo, warn as traceWarn } from "@fltsci/tauri-plugin-tracing";

const stringify = (...args: unknown[]): string =>
	args
		.map((arg) =>
			typeof arg === "string" ? arg : JSON.stringify(arg)
		)
		.join(" ");

export const info = (...args: unknown[]): void => {
	traceInfo(stringify(...args));
};

export const warn = (...args: unknown[]): void => {
	traceWarn(stringify(...args));
};

export const error = (...args: unknown[]): void => {
	traceError(stringify(...args));
};
