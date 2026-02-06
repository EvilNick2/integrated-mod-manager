import { Button } from "@/components/ui/button";
import { DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { openFile, saveConfigs, updateIniVars } from "@/utils/filesys";
// import { formatHotkeyDisplay, normalizeHotkey } from "@/utils/hotkeyUtils";
import { join } from "@/utils/hotreload";
import { ModHotKeys } from "@/utils/types";

import { DATA, MOD_LIST } from "@/utils/vars";

import { useSetAtom } from "jotai";
import { ArrowUpRightFromSquareIcon, InfoIcon, IterationCcwIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { info } from "@/lib/logger";

function ModPreferences({ item }: { item: any }) {
	// const textData = useAtomValue(TEXT_DATA);
	const setData = useSetAtom(DATA);
	const setModList = useSetAtom(MOD_LIST);
	const [keys, setKeys] = useState([] as any);
	useEffect(() => {
		const k = {} as any;
		item.keys.forEach((keyConfig: ModHotKeys) => {
			if(!keyConfig.default) return;
			if (!k[keyConfig.file]) {
				k[keyConfig.file] = [];
			}
			k[keyConfig.file].push(keyConfig);
		});
		setKeys(
			Object.keys(k).map((key) => {
				return { file: key, keys: k[key] };
			})
		);
	}, [item]);
	info('Mod Preferences', {keys});
	const setVal = useCallback(
		(type = "pref" as "pref" | "reset" | "name", file: string, target: string, value: any) => {
			setData((prev: any) => {
				prev = prev || {};
				prev[item.path] = prev[item.path] || {};
				prev[item.path].vars = prev[item.path].vars || {};
				prev[item.path].vars[file] = prev[item.path].vars[file] || {};
				prev[item.path].vars[file][target] = prev[item.path].vars[file][target] || {};
				prev[item.path].vars[file][target][type] = value;
				if (!value) {
					delete prev[item.path].vars[file][target][type];
					if (Object.keys(prev[item.path].vars[file][target]).length === 0) {
						delete prev[item.path].vars[file][target];
						if (Object.keys(prev[item.path].vars[file]).length === 0) {
							delete prev[item.path].vars[file];
							if (Object.keys(prev[item.path].vars).length === 0) {
								delete prev[item.path].vars;
								if (Object.keys(prev[item.path]).length === 0) {
									delete prev[item.path];
								}
							}
						}
					}
				}
				return {
					...prev,
				};
			});
			saveConfigs();
		},
		[item.path, setData]
	);
	return (
		<DialogContent className="min-w-250">
			<Tooltip>
				<TooltipTrigger></TooltipTrigger>
				<TooltipContent className="opacity-0"></TooltipContent>
			</Tooltip>

			<div className="min-h-fit text-accent my-6 text-3xl">Edit Mod Configurations</div>
			<div className="max-h-110 min-h-110 flex flex-col w-full h-full p-2 pt-0 overflow-x-hidden overflow-y-scroll text-gray-300 rounded-sm">
				<div className="bg-background/80 button-like text-border backdrop-blur border-muted/20 sticky top-0 z-10 flex w-full px-8 py-2 border rounded-md">
					<Tooltip>
						<TooltipTrigger className="text-accent flex items-center justify-center w-full gap-2 mr-2 -ml-2">
							<InfoIcon className="text-accent/70 cursor-help inline-block w-4 h-4 ml-1" />
							Name
						</TooltipTrigger>
						<TooltipContent className="w-48 px-1 text-center">
							{"This only will only reflect in the UI and will not affect any mod/ini files."}
						</TooltipContent>
					</Tooltip>
					|{/* <div className="text-accent w-1/5 text-center">Target Var</div>| */}
					<Tooltip>
						<TooltipTrigger className="text-accent flex items-center justify-center w-full gap-2">
							<InfoIcon className="text-accent/70 cursor-help inline-block w-4 h-4 ml-1" />
							Default Value
						</TooltipTrigger>
						<TooltipContent className="w-48 px-1 text-center">
							{"The default value of the variable in the mod/ini file. Changes will be written to the mod/ini file."}
						</TooltipContent>
					</Tooltip>
					|
					<Tooltip>
						<TooltipTrigger className="text-accent flex items-center justify-center w-full gap-2">
							<InfoIcon className="text-accent/70 cursor-help inline-block w-4 h-4 ml-1" />
							Preference
						</TooltipTrigger>
						<TooltipContent className="w-48 px-1 text-center">
							{
								"To set your preferred settings directly for the mod injector user preferences. This will not affect any mod/ini files."
							}
						</TooltipContent>
					</Tooltip>
					|
					<Tooltip>
						<TooltipTrigger className="text-accent flex items-center justify-center w-full gap-2 -mr-4">
							{/* <InfoIcon className="text-accent/70 cursor-help inline-block w-4 h-4 ml-1" /> */}
							Expected Values
						</TooltipTrigger>
						{/* <TooltipContent className="w-48 px-1 text-center">
							{
								"Shows the current key-binding for this variable. Future versions of IMM may allow changing key-bindings here."
							}
						</TooltipContent> */}
					</Tooltip>
				</div>
				{keys.map((file: any, index: number) => (
					<div key={index} className="min-h-fit flex flex-col w-full px-4 py-2 mt-2 border rounded-md">
						<div className="text-accent flex items-center gap-1 mb-2 text-sm">
							<Button
								className="aspect-square mt-0.5 max-h-5 max-w-5"
								onClick={() => {
									openFile(join(item.path, file.file));
								}}
							>
								<ArrowUpRightFromSquareIcon className="max-h-3" />
							</Button>
							{file.file}
						</div>
						{file.keys.map((keyConfig: any, index: number) => {
							const nameDefault = keyConfig.name == keyConfig.target;
							const defDefault = keyConfig.reset === null || keyConfig.reset === undefined;
							const prefDefault = keyConfig.pref === null || keyConfig.pref === undefined;
							return (
								<div
									key={index}
									className="odd:bg-background/50 even:bg-background/30 text-border flex w-full gap-4 px-5 py-2 rounded-md"
								>
									<div className="w-full min-w-[24.5%] flex items-center">
										<Input
											className="text-muted-foreground w-full bg-transparent text-ellipsis -mr-8.5"
											defaultValue={keyConfig.name}
											style={{
												paddingRight: nameDefault ? "" : "2rem",
											}}
											onBlur={(e) => {
												const val = e.currentTarget.value;
												if (val == keyConfig.name || (!val && !keyConfig.name)) {
													return;
												}
												setVal("name", keyConfig.file, keyConfig.target, val);
											}}
										/>
										<Tooltip>
											<TooltipTrigger
												className="duration-300"
												style={{
													pointerEvents: nameDefault ? "none" : "auto",
													opacity: nameDefault ? 0 : 1,
												}}
												onClick={(e) => {
													const prev = e.currentTarget.previousElementSibling as HTMLInputElement;
													if (prev) {
														prev.focus();
														prev.value = keyConfig.target;
														prev.blur();
													}
												}}
											>
												<Button variant="ghost" className=" h-8 w-8">
													<IterationCcwIcon className="max-h-4 rotate-180" />
												</Button>
											</TooltipTrigger>
											<TooltipContent className="max-w-xs">Reset Name</TooltipContent>
										</Tooltip>
									</div>
									<div className="w-full min-w-[24.5%] flex items-center">
										<Input
											className="text-muted-foreground w-full bg-transparent -mr-8.5"
											style={{
												textAlign: isNaN(Number(keyConfig.default)) ? "left" : "right",
												paddingRight: defDefault ? "" : "2rem",
											}}
											defaultValue={keyConfig.default}
											onBlur={(e) => {
												const val = e.currentTarget.value;
												if (val == keyConfig.default || (!val && !keyConfig.default)) {
													return;
												}
												if (keyConfig.reset === null || keyConfig.reset === undefined) {
													setVal("reset", keyConfig.file, keyConfig.target, keyConfig.default);
												} else if (val === keyConfig.reset) {
													setVal("reset", keyConfig.file, keyConfig.target, null);
												}
												info("Updating ini", {src: join(item.path, keyConfig.file), target: keyConfig.target, content: val });
												updateIniVars(join(item.path, keyConfig.file), {
													[keyConfig.target.toLowerCase()]: val,
												}).then((success) => {
													if (success) {
														setModList((prev: any) => {
															const newList = prev.map((mod: any) => {
																if (mod.path === item.path) {
																	mod.keys = mod.keys.map((k: any) => {
																		if (k.file === keyConfig.file && k.target === keyConfig.target) {
																			k.default = val;
																		}
																		return k;
																	});
																	return {
																		...mod,
																	};
																}
																return mod;
															});
															return newList;
														});
													} else {
													}
												});
											}}
										/>
										<Tooltip>
											<TooltipTrigger
												className="duration-300"
												style={{
													pointerEvents: defDefault ? "none" : "auto",
													opacity: defDefault ? 0 : 1,
												}}
												onClick={(e) => {
													const prev = e.currentTarget.previousElementSibling as HTMLInputElement;
													if (prev) {
														prev.focus();
														prev.value = keyConfig.reset;
														prev.blur();
													}
												}}
											>
												<Button variant="ghost" className=" h-8 w-8">
													<IterationCcwIcon className="max-h-4 rotate-180" />
												</Button>
											</TooltipTrigger>
											<TooltipContent className="max-w-xs">Reset Default Value</TooltipContent>
										</Tooltip>
									</div>
									<div className="w-full min-w-[24.5%] flex items-center">
										<Input
											className="text-muted-foreground w-full bg-transparent duration-200 -mr-8.5"
											style={{
												textAlign: isNaN(Number(keyConfig.pref ?? keyConfig.default)) ? "left" : "right",
												paddingRight: prefDefault ? "" : "2rem",
											}}
											defaultValue={keyConfig.pref}
											onBlur={(e) => {
												const val = e.currentTarget.value;
												if (val == keyConfig.pref || (!val && !keyConfig.pref)) {
													return;
												}
												setVal("pref", keyConfig.file, keyConfig.target, val);
											}}
											placeholder="Default Value"
										/>
										<Tooltip>
											<TooltipTrigger
												className="duration-300"
												style={{
													pointerEvents: prefDefault ? "none" : "auto",
													opacity: prefDefault ? 0 : 1,
												}}
												onClick={(e) => {
													const prev = e.currentTarget.previousElementSibling as HTMLInputElement;
													if (prev) {
														prev.focus();
														prev.value = "";
														prev.blur();
													}
												}}
											>
												<Button variant="ghost" className=" h-8 w-8">
													<IterationCcwIcon className="max-h-4 rotate-180" />
												</Button>
											</TooltipTrigger>
											<TooltipContent className="max-w-xs">Reset Default Value</TooltipContent>
										</Tooltip>
									</div>
									<div className="text-muted-foreground flex items-center justify-center w-full min-w-[24.5%]">
										{keyConfig.values.toSorted().join(" , ") || "Unspecified"}
									</div>
								</div>
							);
						})}
					</div>
				))}
			</div>
		</DialogContent>
	);
}

export default ModPreferences;
