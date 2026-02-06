import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { BANANA_LINK, DISCORD_LINK, VERSION } from "@/utils/consts";
import { getTimeDifference, isOlderThanOneDay } from "@/utils/utils";
import { IMM_UPDATE, SETTINGS, TEXT_DATA, UPDATER_OPEN } from "@/utils/vars";
import { Checkbox } from "@/components/ui/checkbox";
import { useAtom, useAtomValue } from "jotai";
import { CircleAlert, DownloadIcon, Loader2Icon, UploadIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { saveConfigs } from "@/utils/filesys";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogTrigger } from "@/components/ui/alert-dialog";
let prev = 0;
let counter = 3000;
let openedAt = 0;
let firstMoved = false;
let timer : ReturnType<typeof setTimeout>;
function Updater() {
	const textData = useAtomValue(TEXT_DATA);
	const [update, setUpdate] = useAtom(IMM_UPDATE);
	const ref1 = useRef<HTMLDivElement>(null);
	const ref2 = useRef<HTMLDivElement>(null);
	const ref3 = useRef<HTMLDivElement>(null);
	const [updaterOpen, setUpdaterOpen] = useAtom(UPDATER_OPEN);
	const [settings, setSettings] = useAtom(SETTINGS);
	const preReleases = settings.global.preReleases;
	useEffect(() => {
		let interval: ReturnType<typeof setInterval>;
		if (update?.status === "ready" && counter == 3000)
			interval = setInterval(() => {
				if (ref3.current)
					ref3.current.innerHTML = textData._Main._components._Updater.In.replace(
						"<time>",
						Math.ceil(counter / 10).toString()
					);
				counter--;
				if (counter < 0) {
					update.raw?.install();
					clearInterval(interval);
				}
			}, 100);
	}, [update, ref3]);
	let maj = [];
	let min = [];
	let pat = [];
	if (update?.body) {
		let json = JSON.parse(update.body);
		//info(json)
		maj = json.major || [];
		min = json.minor || [];
		pat = json.patch || [];
	}

	return (
		<Dialog open={updaterOpen} onOpenChange={setUpdaterOpen}>
			<DialogTrigger asChild>
				<Button
					disabled={updaterOpen}
					className="text-ellipsis bg-sidebar flex h-6 p-0 overflow-hidden text-xs pointer-events-auto"
				>
					<img src="IMMDecor.png" className="h-6.5 min-w-fit p-2 pr-0" />
					{update && update.status !== "ignored" ? (
						{
							available: (
								<>
									<div className=" min-w-fit text-background button-like bg-accent flex items-center justify-center w-full h-5 gap-1 px-2 rounded-sm pointer-events-none">
										<UploadIcon className="max-h-3.5" />
										<Label className=" w-fit text-xs pointer-events-none">{textData.Update}</Label>
									</div>
								</>
							),
							downloading: (
								<div className=" max-w-24 min-w-24 flex flex-col overflow-hidden border rounded-md">
									<div
										key={"down1"}
										className="fade-in max-w-24 min-w-24 min-h-5 z-10 w-full h-5 -mb-5 pointer-events-none"
									>
										<div
											ref={ref1}
											className="min-h-5 height-in bg-accent text-background hover:brightness-125 rounded-r-md flex flex-col self-start justify-center h-5 overflow-hidden"
											style={{ width: prev + "%" }}
										>
											<div className="min-w-24 fade-in flex items-center justify-center gap-1 pointer-events-none">
												<Loader2Icon className="h-3 max-h-3 w-3 max-w-3 -ml-0.5 -mt-0.5 animate-spin" />

												<Label className=" w-fit max-w-24 text-[0.6rem] pointer-events-none">
													{textData._Main._components._Updater.Downloading}
												</Label>
											</div>
										</div>
									</div>

									<div
										key={"down2"}
										className="fade-in min-w-24 max-w-24 min-h-5 text-accent flex items-center justify-center w-full h-5 gap-1 pointer-events-none"
									>
										<Loader2Icon className="h-3 max-h-3 w-3 max-w-3 -ml-0.5 -mt-0.5 animate-spin" />

										<Label className=" w-fit max-w-24 text-[0.6rem] pointer-events-none">
											{textData._Main._components._Updater.Downloading}
										</Label>
									</div>
								</div>
							),
							ready: (
								<div className=" min-w-fit text-background button-like bg-accent flex items-center justify-center w-full h-5 gap-1 px-2 rounded-sm pointer-events-none">
									<DownloadIcon className="max-h-3.5" />
									<Label className=" w-fit max-w-24 text-xs pointer-events-none">{textData.Install}</Label>
								</div>
							),
							error: (
								<div className=" min-w-fit text-background button-like bg-destructive flex items-center justify-center w-full h-5 gap-1 px-2 rounded-sm pointer-events-none">
									<CircleAlert className="max-h-3.5" />
									<Label className=" w-fit max-w-24 text-xs pointer-events-none">
										{textData._Main._components._Updater.Error}
									</Label>
								</div>
							),
							installed: textData.Installed,
						}[update.status]
					) : (
						<div className="mr-1">{`v${VERSION}`}</div>
					)}
				</Button>
			</DialogTrigger>
			<DialogContent className="game-font">
				<div className="min-h-fit text-accent mt-6 text-3xl">{textData._Main._components._Updater.Updater}</div>
				<div className="min-h-fit text-muted-foreground -mt-4">v{VERSION}</div>
				<div className="min-h-fit text-muted-foreground -mt-4">
					<AlertDialog>
						<AlertDialogTrigger>
							<Button
								className=" max-h-7 text-sm"
								onClick={() => {
									openedAt = Date.now();
									firstMoved = false;
								}}
							>
								Credits
							</Button>
						</AlertDialogTrigger>
						<AlertDialogContent
							className="min-w-full border-0 h-full max-h-[calc(100%-2rem)] mt-4 overflow-hidden"
							onClick={(e) => {
								(e.currentTarget.firstChild as HTMLButtonElement)?.click();
								clearTimeout(timer);
							}}
							onMouseMove={() => {
								if(firstMoved) return;
								const elapsed = Date.now() - openedAt;
								timer = setTimeout(() => {
									(document.getElementById("cancel-alert") as HTMLButtonElement)?.click();
								}, Math.max(50000 - elapsed, 0));
								firstMoved = true;
								
							}}
						>
							<AlertDialogCancel id="cancel-alert" className="absolute top-4 right-4 z-10 bg-transparent " />
							<style>{`
								@keyframes crawl {
									0% { transform: rotateX(45deg) translateY(0%); margin-top:0%; }
									100% { transform: rotateX(45deg) translateY(-200%); margin-top:-50%; }
								}
							`}</style>
							<div className="absolute inset-0 flex justify-center overflow-hidden" style={{ perspective: "400px" }}>
								<div
									className="absolute w-full max-w-2xl text-center text-muted-foreground top-full"
									style={{
										animation: "crawl 100s linear",
										transformOrigin: "50% 0%",
									}}
								>
									<div className="text-6xl font-bold textaccent text-accent mb-8">CREDITS</div>
									<div className="text-2xl mb-16 opacity-80">A long time ago in a codebase far, far away...</div>

									<div className="text-3xl font-bold textaccent text-accent mb-4">CREATOR</div>
									<div className="text-xl mb-8">YourBadLuck</div>
									<div className="text-3xl font-bold textaccent text-accent mb-4">CONTRIBUTORS</div>
									<div className="text-xl mb-8">Antonzlo (Dev,TL-ru)</div>
									<div className="text-xl mb-8">118ununoctium (TL-cn)</div>

									{/* <div className="text-3xl font-bold text-accent mb-4">LEAD DEVELOPER</div>
									<div className="text-xl mb-8">Petrascyll</div> */}

									<div className="text-3xl font-bold textaccent text-accent mb-4">EMERGENCY FOOD</div>
									<div className="text-xl mb-8">Paimon (allegedly)</div>

									<div className="text-3xl font-bold textaccent text-accent mb-4">OSMANTHUS WINE TASTER</div>
									<div className="text-xl mb-2">Zhongli</div>
									{/* <div className="text-lg mb-8 opacity-70">"...but where are those who share the memory?"</div> */}

									{/* <div className="text-3xl font-bold text-accent mb-4">50/50 LOSS SUPPORT GROUP</div>
									<div className="text-xl mb-2">Qiqi Havers Anonymous</div>
									<div className="text-lg mb-8 opacity-70">C6 and still counting...</div> */}

									{/* <div className="text-3xl font-bold text-accent mb-4">RESIN REFRESH DEPARTMENT</div>
									<div className="text-xl mb-8">The 160/160 Waiting Room</div> */}

									<div className="text-3xl font-bold textaccent text-accent mb-4">ARTIFACT RNG CONSULTANT</div>
									<div className="text-xl mb-2">Flat DEF Enthusiast</div>
									<div className="text-lg mb-8 opacity-70">Every. Single. Roll.</div>

									<div className="text-3xl font-bold textaccent text-accent mb-4">BANGBOO CARETAKER</div>
									<div className="text-xl mb-8">Belle & Wise</div>

									<div className="text-3xl font-bold textaccent text-accent mb-4">THE BEST COMMISION BROKER EVER</div>
									<div className="text-xl mb-8">Venus</div>

									<div className="text-3xl font-bold textaccent text-accent mb-4">ECHO FARMING VICTIM</div>
									<div className="text-xl mb-2">Rover</div>
									<div className="text-lg mb-8 opacity-70">2000 echoes, still no 5-cost drop</div>

									{/* <div className="text-3xl font-bold text-accent mb-4">TOWER OF ADVERSITY SURVIVOR</div>
									<div className="text-xl mb-8">Floor 8 PTSD Support</div>

									<div className="text-3xl font-bold text-accent mb-4">JIYAN APPRECIATION SOCIETY</div>
									<div className="text-xl mb-8">Down bad since release</div>

									<div className="text-3xl font-bold text-accent mb-4">EHE TE NANDAYO TRANSLATOR</div>
									<div className="text-xl mb-8">Venti's Wine Cellar</div>

									<div className="text-3xl font-bold text-accent mb-4">XINYAN REMEMBRANCE CLUB</div>
									<div className="text-xl mb-8">Population: 3</div>

									<div className="text-3xl font-bold text-accent mb-4">PREVIEW IMAGE INSPECTOR</div>
									<div className="text-xl mb-8">NSFW Toggle QA Team</div>

									<div className="text-3xl font-bold text-accent mb-4">3DMIGOTO WIZARDRY</div>
									<div className="text-xl mb-8">Hash Collision Survivors</div> */}

									<div className="text-3xl font-bold textaccent text-accent mb-4">The Real MVPs</div>
									<div className="text-xl mb-8">Modders who actually make the mods</div>

									<div className="text-3xl font-bold textaccent text-accent mb-4">SPECIAL THANKS</div>
									<div className="text-xl mb-2">The Modding Community</div>
									{/* <div className="text-xl mb-2">All the Modders</div> */}
									<div className="text-xl mb-2">Testers & Bug Reporters at the Discord Server</div>
									<div className="text-xl mb-2">And you, the User!</div>
									{/* <div className="text-xl mb-16">And Everyone Who Lost Their 50/50</div> */}

									<div className="text-4xl font-bold mt-16 textaccent text-accent mb-8">MAY THE MODS BE WITH YOU</div>
								</div>
							</div>
						</AlertDialogContent>
					</AlertDialog>
				</div>
				<div className="flex flex-col items-center justify-center w-full -mt-4 mb-6">
					<div className=" flex items-center gap-2">
						<Checkbox
							id="checkbox"
							className=" checked:bg-accent bgaccent"
							onCheckedChange={(checked) => {
								setSettings((prev) => ({
									...prev,
									global: {
										...prev.global,
										preReleases: checked ? true : false,
									},
								}));
								saveConfigs();
								setUpdate(
									(prev) =>
										prev && {
											...prev,
											status: checked || isOlderThanOneDay(prev.date || "") ? "available" : "ignored",
										}
								);
							}}
							checked={preReleases}
						/>
						<label className="text-muted-foreground text-sm">{textData.GetPre}</label>
					</div>
				</div>

				{update && update.status !== "ignored" && (
					<>
						<div className="min-h-2 text-accent w-full text-xl">
							Version {update.version}{" "}
							<span className="text-muted-foreground text-base">
								({getTimeDifference(Date.now() / 1000, new Date(update.date).getTime() / 1000)}{" "}
								{textData._Main._components._Updater.ago})
							</span>
						</div>
						<Separator className="my-2" />
					</>
				)}
				<div className="h-72 max-h-72 flex flex-col w-full px-4 overflow-x-hidden overflow-y-auto">
					{update && update.status !== "ignored" ? (
						<>
							{maj.length > 0 && <div className="min-h-6 text-accent">{textData._Main._components._Updater.Maj}:</div>}
							{maj.map((item: string, index: number) => (
								<div key={index} className="min-h-fit text-muted-foreground flex items-center gap-2 mt-1 text-lg">
									<div className="min-w-1 min-h-1 aspect-square bg-accent self-start mt-3 rounded-full"></div>
									<div>{item}</div>
								</div>
							))}
							{min.length > 0 && (
								<div className="min-h-6 text-accent mt-4">{textData._Main._components._Updater.Min}:</div>
							)}
							{min.map((item: string, index: number) => (
								<div key={index} className="min-h-fit text-base text-muted-foreground flex items-center mt-0.5 gap-2">
									<div className="min-w-1 min-h-1 self-start mt-2.5 aspect-square bg-accent rounded-full"></div>
									<div>{item}</div>
								</div>
							))}
							{pat.length > 0 && (
								<div className="min-h-6 text-accent mt-4">{textData._Main._components._Updater.Patch}:</div>
							)}
							{pat.map((item: string, index: number) => (
								<div key={index} className="min-h-fit text-muted-foreground flex items-center gap-2 mt-0.5">
									<div className="min-w-1 min-h-1 self-start mt-2.5 aspect-square bg-accent rounded-full"></div>
									<div>{item}</div>
								</div>
							))}
						</>
					) : (
						<div className="text-muted-foreground flex flex-col items-center justify-center w-full h-full">
							{textData._Main._components._Updater.Lat}
							<div className="mt-124 absolute flex items-center gap-2">
								<label className="opacity-40">{textData.BFR}</label>
								<label>:</label>
								<a
									href={BANANA_LINK}
									target="_blank"
									className="hover:opacity-100 flex items-center gap-1 text-xs duration-200 opacity-50"
								>
									{" "}
									<img className="h-4" src="/GBLogo.png" /> <img className="h-3" src="/GBTitle.png" />
								</a>
								|
								<a
									href={DISCORD_LINK}
									target="_blank"
									className="hover:opacity-100 flex items-center gap-1 text-xs duration-200 opacity-50"
								>
									{" "}
									<img className="h-6" src="/DCLogoTitle.svg" />
								</a>
							</div>
						</div>
					)}
				</div>
				{update && update.status !== "ignored" && (
					<div className="flex items-center justify-end w-full h-10 mt-2">
						<div ref={ref3} className="text-muted-foreground w-full text-xs">
							{update.status == "ready" ? (
								<>{textData._Main._components._Updater.Soon}</>
							) : (
								textData._Main._components._Updater.Use
							)}
						</div>
						<Button
							className="w-28"
							disabled={update.status == "downloading" || update.status == "installed"}
							// disabled={disabled}
							onClick={async () => {
								if ((update.status === "available" || update.status === "error") && update.raw) {
									let downloaded = 0;
									let contentLength = 0;

									await update.raw?.download((event: any) => {
										switch (event.event) {
											case "Started":
												contentLength = event.data.contentLength;
												setUpdate((prev) => (prev ? { ...prev, status: "downloading" } : prev));
												//info(`started downloading ${event.data.contentLength} bytes`);
												break;
											case "Progress":
												downloaded += event.data.chunkLength;
												prev = Math.floor((downloaded / contentLength) * 100);
												if (ref1.current) ref1.current.style.width = prev + "%";
												if (ref2.current) ref2.current.innerHTML = `${prev}%`;

												//info(`downloaded ${downloaded} from ${contentLength}`);
												break;
											case "Finished":
												counter = 3000;
												setUpdate((prev) => (prev ? { ...prev, status: "ready" } : prev));
												setUpdaterOpen(true);
												//info("download finished");
												break;
										}
									});
								} else if (counter > 0) {
									update.raw?.install();
								}
							}}
						>
							<div ref={ref2}>
								{
									{
										available: textData.Update,
										downloading: textData._Main._components._Updater.Downloading,
										ready: textData._Main._components._Updater.InstallNow,
										error: textData._Main._components._Updater.Retry,
										installed: textData.Installed,
									}[update.status]
								}
							</div>
						</Button>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}

export default Updater;
