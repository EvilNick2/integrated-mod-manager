import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Label } from "@/components/ui/label";
import { fetchMod, formatSize, getImageUrl, getTimeDifference, modRouteFromURL } from "@/utils/utils";
import {
	DATA,
	DOWNLOAD_LIST,
	FILE_TO_DL,
	GAME,
	INSTALLED_ITEMS,
	MOD_LIST,
	ONLINE_DATA,
	ONLINE_SELECTED,
	RIGHT_SLIDEOVER_OPEN,
	TEXT_DATA,
} from "@/utils/vars";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
	ChevronDownIcon,
	DiscIcon,
	DownloadIcon,
	EllipsisVerticalIcon,
	EyeIcon,
	InfoIcon,
	LinkIcon,
	LoaderIcon,
	MessageSquareIcon,
	PlusIcon,
	Redo2Icon,
	ThumbsUpIcon,
	UploadIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import Carousel from "./components/Carousel";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { createModDownloadDir, refreshModList, saveConfigs } from "@/utils/filesys";
import { Separator } from "@radix-ui/react-separator";
import { UNCATEGORIZED } from "@/utils/consts";
import { addToast } from "@/_Toaster/ToastProvider";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { invoke } from "@tauri-apps/api/core";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
// import { OnlineMod } from "@/utils/types";
let now = Date.now() / 1000;

function RightOnline({ open }: { open: boolean }) {
	const textData = useAtomValue(TEXT_DATA);
	const selected = useAtomValue(ONLINE_SELECTED);
	const setRightSlideOverOpen = useSetAtom(RIGHT_SLIDEOVER_OPEN);
	const [modList, setModList] = useAtom(MOD_LIST);
	const setData = useSetAtom(DATA);
	const onlineData = useAtomValue(ONLINE_DATA);
	const [aboutOpen, setAboutOpen] = useState(false);
	const [updateOpen, setUpdateOpen] = useState(false);
	const [popoverOpen, setPopoverOpen] = useState(false);
	const [altPopoverOpen, setAltPopoverOpen] = useState(false);
	const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
	const [linkExistingPopoverOpen, setLinkExistingPopoverOpen] = useState(false);
	const [cmdValue, setCmdValue] = useState("");
	const game = useAtomValue(GAME);
	const setDownloadList = useSetAtom(DOWNLOAD_LIST);
	const installedItems = useAtomValue(INSTALLED_ITEMS);
	const [fileToDl, setFileToDl] = useAtom(FILE_TO_DL);
	const item = onlineData[selected] as any;
	const installedItem = installedItems.find((it) => it.source && modRouteFromURL(it.source) == selected) || null;
	const type = installedItem ? (installedItem.modStatus ? "Update" : "Reinstall") : "Install";
	const addToDownloadQueue = useCallback(
		async (file: any) => {
			setDownloadList((prev: any) => {
				//300ms promise await
				// await new Promise(resolve => setTimeout(resolve, 300));

				let dlitem = {
					status: "pending",
					addon: altPopoverOpen,
					preview:
						item._aPreviewMedia && item._aPreviewMedia._aImages && item._aPreviewMedia._aImages.length > 0
							? item._aPreviewMedia._aImages[0]._sBaseUrl + "/" + item._aPreviewMedia._aImages[0]._sFile
							: "",
					category: item._aCategory?._sName.replaceAll("Skins", UNCATEGORIZED) || UNCATEGORIZED,
					source: item._sProfileUrl || "",
					file: file._sDownloadUrl,
					updated: file._tsDateAdded,
					name: item._sName + (altPopoverOpen ? ` - ${file._sFile}` : ""),
					fname: file._sFile,
				} as any;
				let count = 1;
				let downloadList = [];
				if (prev?.downloading && Object.keys(prev.downloading).length > 0)
					downloadList.push({ ...prev.downloading, status: "downloading" });
				if (prev?.queue)
					downloadList = [...downloadList, ...prev.queue.map((item: any) => ({ ...item, status: "pending" }))];
				if (prev?.completed)
					downloadList = [...downloadList, ...prev.completed.map((item: any) => ({ ...item, status: "completed" }))];
				while (downloadList.find((x) => x.name == dlitem.name && x.fname == dlitem.fname)) {
					dlitem.name = `${item._sName} (${count})`;
					count++;
				}

				return {
					downloading: prev?.downloading || null,
					completed: prev?.completed || [],
					queue: [...(prev?.queue || []), dlitem],
					extracting: prev?.extracting || [],
				};
			});
			addToast({ type: "success", message: "File added to download queue." });
		},
		[altPopoverOpen, item, setDownloadList]
	);
	useEffect(() => {
		now = Date.now() / 1000;
		const controller = new AbortController();
		if (selected) {
			setRightSlideOverOpen(true);
			setAboutOpen(true);
			setUpdateOpen(false);
			setPopoverOpen(false);
			setAltPopoverOpen(false);
			fetchMod(selected, controller);
		} else {
			setRightSlideOverOpen(false);
		}
		return () => {
			controller.abort();
		};
	}, [selected]);
	useEffect(() => {
		if (type != "Install" && item?._sProfileUrl) {
			installedItem &&
				setData((prev: any) => {
					if (installedItem.name) {
						prev[installedItem.name] = { ...prev[installedItem.name], viewedAt: now * 1000 };
					}
					return { ...prev };
				});
			refreshModList().then((list) => {
				setModList(list);
			});
			saveConfigs();
		}
	}, [selected]);
	useEffect(() => {
		if (item?._aFiles) {
			const file = item._aFiles.find((f: any) => f._idRow == fileToDl);
			if (file) {
				addToDownloadQueue(file);
				setFileToDl("");
				
			}
		}
	}, [item?._aFiles]);
	const popoverContent = item?._aFiles?.map((file: any) => (
		<Button
			className="min-h-fit data-wuwa:p-2 flex items-center justify-center min-w-full gap-1 p-4 overflow-hidden"
			style={{
				borderRadius: game == "GI" ? "4px" : "4px",
			}}
			onClick={() => {
				addToDownloadQueue(file);
				setPopoverOpen(false);
				setAltPopoverOpen(false);
			}}
		>
			<div className="w-[calc(100%-6rem)] text-start flex flex-col gap-1">
				<p className=" text-ellipsis wrap-break-word overflow-hidden text-base resize-none">{file._sFile}</p>
				<div className=" min-w-fit text-background flex flex-wrap w-full gap-1 text-xs">
					{file._aAnalysisWarnings?.contains_exe ? (
						<div className=" bg-destructive item flex justify-center w-12 px-1 text-center rounded-lg">Exe</div>
					) : (
						""
					)}
					{file._sAnalysisState == "done" ? (
						<>
							{file._sAvState == "done" && file._sAvResult == "clean" ? (
								<div className=" bg-success w-16 px-1 text-center rounded-lg">Clean</div>
							) : (
								<div className=" bg-destructive w-16 px-1 text-center rounded-lg">Dangerous</div>
							)}
							{/* {file._sClamAvResult == "clean" ? (
								<div className=" bg-success w-16 px-1 text-center rounded-lg">ClamAV</div>
							) : (
								<div className=" bg-destructive w-16 px-1 text-center rounded-lg">ClamAV</div>
							)} */}
						</>
					) : (
						<div className=" bg-warn w-12 px-1 text-center rounded-lg">pending</div>
					)}
				</div>
				<div className="flex items-center gap-1">
					{file._sDescription && file._sDescription.length > 0 && (
						<Tooltip>
							<TooltipTrigger>
								<InfoIcon />
							</TooltipTrigger>
							<TooltipContent className="max-w-64 w-fit text-center">
								<p className="max-w-64 text-center break-words">{file._sDescription}</p>
							</TooltipContent>
						</Tooltip>
					)}
					<p className="w-52 text-ellipsis brightness-75 wrap-break-word overflow-hidden text-xs resize-none">
						{file._sDescription}
					</p>
				</div>
			</div>
			<div className="min-w-24 flex flex-col items-center">
				<div className="flex gap-1">
					{" "}
					<LoaderIcon />
					{getTimeDifference(now, file._tsDateAdded)}
				</div>
				<div className="flex gap-1">
					{" "}
					<DownloadIcon />
					{file._nDownloadCount}
				</div>
				<div className=" flex gap-1">
					{" "}
					<DiscIcon />
					{formatSize(file._nFilesize || 0)}
				</div>
			</div>
		</Button>
	));
	return (
		<AnimatePresence mode="wait">
			{open && (
				<motion.div
					initial={{ translateX: "100%", opacity: 0 }}
					animate={{ translateX: "0%", opacity: 1 }}
					exit={{ translateX: "100%", opacity: 0 }}
					transition={{ duration: 0.3, ease: "linear" }}
					className="bg-sidebar bgpattern fixed right-0 z-10 flex flex-col items-center justify-center h-full pt-8 overflow-hidden border-l"
					style={{
						maxWidth: "47vw",
						width: "50rem",
						backdropFilter: "blur(8px)",
						backgroundColor: "color-mix(in oklab, var(--sidebar) 75%, transparent)",
					}}
				>
					<AnimatePresence mode="wait">
						{!selected ? (
							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
								key="no-selection"
								className="text-accent flex items-center justify-center h-full p-4"
							>
								{textData._RightSideBar._RightOnline.NoItem}
							</motion.div>
						) : !onlineData[selected] ? (
							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
								key="loading"
								className="text-accent flex items-center justify-center h-full p-4"
							>
								<LoaderIcon className="animate-spin" />
							</motion.div>
						) : item && (item._bIsPrivate || item._bIsTrashed || item._bIsWithheld) ? (
							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
								key="loading"
								className="text-accent flex flex-col items-center justify-center h-full gap-4 p-4"
							>
								This mod has been {item._bIsPrivate ? "set to private" : item._bIsTrashed ? "deleted" : "withheld"}
								{selected.startsWith("Mod") && <a href={`https://gamebanana.com/${selected.replace("Mod","mods")}`} target="_blank" className="text-xs">View in browser</a>}
							</motion.div>
						) : (
							<motion.div
								key={"loaded" + selected}
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								transition={{ duration: 0.2 }}
								className="flex flex-col items-center w-full h-full overflow-hidden duration-300"
							>
								<div className="text-accent min-h-16 flex items-center justify-start w-full gap-3 px-3 border-b">
									<div className="min-w-fit trs bg-button zzz-border flex items-center gap-2 p-2 rounded-md">
										<img
											className="aspect-square min-w-6 max-w-6 scale-120 ctrs h-full rounded-full pointer-events-none"
											onError={(e) => {
												e.currentTarget.src = "/who.jpg";
											}}
											src={item._aCategory?._sIconUrl || "err"}
										/>

										<span className="ctrs">{item._aCategory?._sName.split(" ")[0]}</span>
									</div>

									<Label key={item._sName} className="w-full text-xl text-center">
										{item._sName}
									</Label>

									<Popover open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
										<PopoverTrigger className="focus-within:outline-none">
											<Button className="min-w-fit ring-transparent outline-transparent aspect-square bg-button zzz-border flex items-center gap-2 p-2 rounded-md">
												<LinkIcon />
											</Button>
										</PopoverTrigger>
										<PopoverContent className="w-fit bg-sidebar flex flex-col p-2">
											<Button
												onClick={() => {
													navigator.clipboard.writeText(item._sProfileUrl || "");
													addToast({ type: "success", message: textData._RightSideBar._RightOnline.LinkCopied });
													setLinkPopoverOpen(false);
													setLinkExistingPopoverOpen(false);
												}}
											>
												{textData._RightSideBar._RightOnline.CopyLink}
											</Button>
											<Button
												className="w-full mt-2"
												onClick={() => {
													const a = document.createElement("a");
													a.href = item._sProfileUrl || "";
													a.target = "_blank";
													document.body.appendChild(a);
													a.click();
													document.body.removeChild(a);
													setLinkPopoverOpen(false);
													setLinkExistingPopoverOpen(false);
												}}
											>
												{textData._RightSideBar._RightOnline.OpenBrowser}
											</Button>

											<Popover
												open={linkExistingPopoverOpen}
												onOpenChange={(open) => {
													setLinkExistingPopoverOpen(open);
													setCmdValue(item._sName);
												}}
											>
												<PopoverTrigger>
													<Button className="min-w-fit w-full mt-2">
														{textData._RightSideBar._RightOnline.LinkToMod}
													</Button>
												</PopoverTrigger>
												<PopoverContent className="w-84 -mt-37.5 min-h-40 bg-sidebar p-2 flex flex-col">
													<Command>
														<CommandInput
															placeholder={textData.Search}
															value={cmdValue}
															onValueChange={setCmdValue}
															className="h-12"
														/>
														<CommandList>
															<CommandEmpty>{textData._RightSideBar._RightLocal.NoCat}</CommandEmpty>
															<CommandGroup>
																{modList.map((mod) => (
																	<CommandItem
																		key={mod.name}
																		value={mod.path + " " + mod.path.replaceAll("/", " ").replaceAll("_", " ")}
																		onSelect={async () => {
																			const currentValue = mod.path;
																			if (
																				item._aPreviewMedia &&
																				item._aPreviewMedia._aImages &&
																				item._aPreviewMedia._aImages.length > 0
																			) {
																				invoke("download_and_unzip", {
																					fileName: "preview",
																					downloadUrl:
																						item._aPreviewMedia._aImages[0]._sBaseUrl +
																						"/" +
																						item._aPreviewMedia._aImages[0]._sFile,
																					savePath: await createModDownloadDir(mod.parent, mod.name),
																					key:"link_preview_" + mod.name,
																					emit: false,
																				});
																			}
																			setData((prev) => {
																				prev[currentValue] = {
																					...prev[currentValue],
																					source: item._sProfileUrl,
																					updatedAt: Date.now(),
																					viewedAt: 0,
																				};
																				return { ...prev };
																			});
																			setModList((prev) => {
																				return prev.map((m) => {
																					if (m.path == currentValue) {
																						return { ...m, source: item._sProfileUrl };
																					}
																					return m;
																				});
																			});
																			saveConfigs();
																			addToast({
																				type: "success",
																				message: textData._RightSideBar._RightOnline.LinkToModSuccess,
																			});
																			setLinkPopoverOpen(false);
																			setLinkExistingPopoverOpen(false);
																		}}
																		className="button-like zzz-fg-text data-zzz:mt-1"
																	>
																		<img
																			className="aspect-square outline bg-accent/10 flex items-center justify-center object-cover h-12 text-white rounded-full pointer-events-none"
																			onError={(e) => {
																				e.currentTarget.src = "/who.jpg";
																			}}
																			src={getImageUrl(mod.path) || "err"}
																			style={{}}
																		/>

																		<div className="text-ellipsis whitespace-nowrap max-w-56 w-full overflow-hidden break-words">
																			{mod.name}
																		</div>
																		{/* <CheckIcon
																	className={cn("ml-auto", category.name === cat._sName ? "opacity-100" : "opacity-0")}
																/> */}
																	</CommandItem>
																))}
															</CommandGroup>
														</CommandList>

														{/* <div className="pr-5">{manageCategoriesButton({})}</div> */}
													</Command>
												</PopoverContent>
											</Popover>
										</PopoverContent>
									</Popover>
									<div className="min-w-fit trs bg-button zzz-border flex items-center gap-2 p-2 rounded-md">
										<img
											className="aspect-square min-w-6 max-w-6 scale-120 ctrs h-full rounded-full pointer-events-none"
											onError={(e) => {
												e.currentTarget.src = "/who.jpg";
											}}
											src={item._aSubmitter?._sAvatarUrl || "err"}
										/>

										<span className="ctrs">{item._aSubmitter?._sName}</span>
									</div>
								</div>
								<div className="flex flex-col w-full pb-2 mb-24 overflow-hidden overflow-y-scroll">
									<div
										key={item._sName + "pix"}
										className="min-h-fit flex flex-col items-center w-full max-h-full gap-1 px-2 mt-2 mb-3 overflow-hidden pointer-events-none"
									>
										{item._aPreviewMedia && item._aPreviewMedia._aImages && item._aPreviewMedia._aImages.length > 0 && (
											<Carousel data={item._aPreviewMedia._aImages} />
										)}
									</div>
									{item._sText && (
										<Collapsible
											key={item._sName + "abt"}
											className="w-full px-2 pb-3"
											open={aboutOpen}
											onOpenChange={setAboutOpen}
										>
											<CollapsibleTrigger className="text-accent flex items-center justify-between w-full h-8">
												<Button
													className={
														"w-full flex justify-between bg-accent bgaccent   text-background " +
														(aboutOpen
															? "hover:brightness-125"
															: "bg-input/50 text-accent hover:text-accent hover:bg-input")
													}
												>
													{textData._RightSideBar._RightOnline.About}{" "}
													<ChevronDownIcon
														id="deschev"
														className=" transform-[roate(180deg)] duration-200"
														style={{ transform: aboutOpen ? "rotate(180deg)" : "rotate(0deg)" }}
													/>
												</Button>
											</CollapsibleTrigger>
											<CollapsibleContent className="border-accent w-full pt-2 pl-2 mt-2">
												<div className="w-full font-sans" dangerouslySetInnerHTML={{ __html: item._sText }}></div>
											</CollapsibleContent>
										</Collapsible>
									)}
									{item._eUpdate && (
										<Collapsible
											key={item._sName + "upd"}
											className=" w-full px-2 pt-1 pb-1"
											open={updateOpen}
											onOpenChange={setUpdateOpen}
										>
											<CollapsibleTrigger className="text-accent flex items-center justify-between w-full h-8">
												<Button
													className={
														"w-full flex justify-between bg-accent bgaccent   text-background " +
														(updateOpen
															? "hover:brightness-125"
															: "bg-input/50 text-accent hover:text-accent hover:bg-input")
													}
												>
													{textData._RightSideBar._RightOnline.LatestUpd}{" "}
													<ChevronDownIcon
														id="deschev"
														className=" transform-[roate(180deg)] duration-200"
														style={{ transform: updateOpen ? "rotate(180deg)" : "rotate(0deg)" }}
													/>
												</Button>
											</CollapsibleTrigger>
											<CollapsibleContent className="border-accent flex flex-col w-full gap-4 px-2 pt-2 mt-2">
												<div className="text-accent flex items-center justify-between pb-4 border-b">
													{item._sUpdateName}
													<label className="flex flex-col text-xs text-gray-300">
														{" "}
														<label>{item._sUpdateVersion}</label>{" "}
														<label className=" text-cyan-200">{getTimeDifference(now, item._sUpdateDate || 0)}</label>
													</label>
												</div>
												<div className=" flex flex-col gap-2">
													{item._aUpdateChangeLog &&
														item._aUpdateChangeLog.map((changeItem: any, index: number) => (
															<div key={index} className="flex items-center gap-2">
																<div className="min-w-2 min-h-2 self-start mt-1.75 bg-accent bgaccent   rounded-full" />
																<label className=" text-cyan-50 font-sans text-sm">
																	{changeItem.text}- [{changeItem.cat}]
																</label>
															</div>
														))}
												</div>
												{item._sUpdateText && (
													<div className="w-full font-sans" dangerouslySetInnerHTML={{ __html: item._sUpdateText }} />
												)}
											</CollapsibleContent>
										</Collapsible>
									)}
								</div>
								<div className="text-accent min-h-24 justify-evenly absolute bottom-0 flex items-center h-24 min-w-full gap-1 px-1 border-t">
									<div className="min-w-40 grid w-40 grid-cols-3 gap-2 text-xs">
										{[
											<>
												<PlusIcon className="min-h-4 h-4" />
												{getTimeDifference(now, item._tsDateAdded || 0)}
											</>,
											<>
												<LoaderIcon className="h-4" />
												{getTimeDifference(now, item._tsDateModified || 0)}
											</>,
											<>
												<ThumbsUpIcon className="h-4" />
												{item._nLikeCount || "0"}
											</>,

											<>
												<MessageSquareIcon className="h-4" />
												{item._nPostCount || "0"}
											</>,
											<>
												<DownloadIcon className="h-4" />
												{item._nDownloadCount || "0"}
											</>,
											<>
												<EyeIcon className="h-4" />
												{item._nViewCount || "0"}
											</>,
										].map((children) => (
											<label className="zzz-fg-text text-accent flex flex-col items-center justify-center">
												{children}
											</label>
										))}
									</div>
									<Separator className="min-w-0 min-h-full border-l" />
									<div className="min-w-fit flex items-center justify-center w-full gap-1">
										<Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
											<PopoverTrigger
												style={{ width: `${type == "Install" ? "19.5rem" : "16.5rem"}` }}
												className="flex h-10 gap-4 overflow-hidden text-ellipsis bg-button zzz-fg-text button-like text-accent shadow-xs hover:brightness-120  duration-300  items-center justify-center active:scale-90 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"
												disabled={!item._aFiles || item._aFiles?.length == 0}
											>
												{{ Install: <DownloadIcon />, Reinstall: <Redo2Icon />, Update: <UploadIcon /> }[type]}
												{
													{
														Install: textData.Install,
														Reinstall: textData._RightSideBar._RightOnline.Reinstall,
														Update: textData.Update,
													}[type]
												}
											</PopoverTrigger>
											<PopoverContent
												className="w-152 max-w-[calc(42vw-11.625rem)] mr-1 max-h-[75vh] overflow-auto gap-1 bg-sidebar p-1 flex flex-col"
												style={{ marginLeft: type == "Install" ? "0rem" : "3rem", marginBottom: "0.5rem" }}
											>
												{popoverContent}
											</PopoverContent>
										</Popover>

										{type !== "Install" && (
											<Popover open={altPopoverOpen} onOpenChange={setAltPopoverOpen}>
												<PopoverTrigger
													className="w-10 flex h-10 gap-4 overflow-hidden text-ellipsis button-like zzz-fg-text bg-button text-accent shadow-xs hover:brightness-120  duration-300  items-center justify-center active:scale-90 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive"
													disabled={!item._aFiles || item._aFiles?.length == 0}
												>
													<EllipsisVerticalIcon />
												</PopoverTrigger>
												<PopoverContent className="w-152 max-w-[calc(42vw-11.625rem)] mr-2 max-h-[75vh] mb-2 overflow-auto gap-1 bg-sidebar p-1 flex flex-col">
													<Label className="bg-accent/25 data-zzz:bg-zzz-accent-2/25 data-zzz:text-zzz-accent-2 text-accent flex items-center justify-center w-full h-12 text-lg rounded-md">
														{textData._RightSideBar._RightOnline.Sep}
													</Label>
													{popoverContent}
												</PopoverContent>
											</Popover>
										)}
									</div>
								</div>
							</motion.div>
						)}
					</AnimatePresence>
				</motion.div>
			)}
		</AnimatePresence>
	);
}

export default RightOnline;
