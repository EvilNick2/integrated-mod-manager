// import { Button } from "@/components/ui/button";
import { GAME_NAMES } from "@/utils/consts";
import { saveConfigs } from "@/utils/filesys";
import { getPrevGame, initGame, main } from "@/utils/init";
import { switchGameTheme } from "@/utils/theme";
import { Games } from "@/utils/types";
import { GAME, INIT_DONE, SETTINGS, TEXT_DATA } from "@/utils/vars";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";

function Page2({ setPage }: { setPage: (page: number) => void }) {
	const text = useAtomValue(TEXT_DATA);
	const game = useAtomValue(GAME);
	const setInitDone = useSetAtom(INIT_DONE);
	const [settings, setSettings] = useAtom(SETTINGS);
	async function switchGame(gameCode: Games) {
		if (!gameCode) return;
		setInitDone(false);
		setSettings((prev) => ({ ...prev, global: { ...prev.global, game: gameCode } }));
		await saveConfigs(true);
		setTimeout(() => {
			switchGameTheme(gameCode);
		}, 100);

		setPage(0);
		setTimeout(() => {
			main();
		}, 100);
	}
	useEffect(() => {
		if (game) setPage(2);
	}, [game]);
	useEffect(() => {
		function checkEscape(event: KeyboardEvent) {
			if (event.key === "Escape") {
				const prevGame = getPrevGame();
				if (prevGame && !game) {
					switchGame(prevGame as Games);
				}
			}
		}
		window.addEventListener("keydown", checkEscape);
		return () => window.removeEventListener("keydown", checkEscape);
	}, []);
	return (
		<div className="text-muted-foreground fixed flex flex-col items-center justify-center w-screen h-screen gap-4">
			<div className="mb-4 text-3xl">
				{text.Select.split("").map((letter, index) => (
					<span
						key={index}
						className="wave-letter"
						style={{
							animationDelay: `${index * 0.1}s`,
						}}
					>
						{letter === " " ? "\u00A0" : letter}
					</span>
				))}
			</div>
			<div className="flex flex-wrap w-5xl items-center justify-center gap-16 select-none">
				<div
					onClick={async () => {
						if (!settings.global.game) initGame("WW");
						else {
							switchGame("WW");
						}
					}}
					className="flex duration-200 group hover:-mt-2 active:scale-90 p-6 rounded-md aspect-3/2 min-w-56 flex-col items-center wuwa-font"
				>
					<div className=" w-full aspect-square bg-wuwa-accent/0 group-hover:bg-wuwa-accent duration-300 rounded-full blur-3xl z-0 -mb-[100%]" />

					<img src="/WWLogo.png" className="max-h-40 z-0" />
					<label className="mt-8 text-2xl">{GAME_NAMES.WW}</label>
				</div>
				<div
					onClick={async () => {
						if (!settings.global.game) initGame("ZZ");
						else {
							switchGame("ZZ");
						}
					}}
					className="flex duration-200 group hover:-mt-2 active:scale-90 p-6 rounded-md min-w-56.5 flex-col items-center zzz-font"
				>
					<div className=" w-full aspect-square bg-zzz-accent-2/0 group-hover:bg-zzz-accent-2 duration-300 rounded-full blur-3xl z-0 -mb-[100%]" />

					<img src="/ZZLogo.png" className="max-h-40 z-0" />
					<label className="mt-8 text-2xl">{GAME_NAMES.ZZ}</label>
				</div>
				<div
					onClick={async () => {
						if (!settings.global.game) initGame("GI");
						else {
							switchGame("GI");
						}
					}}
					className="flex duration-200 group hover:-mt-2 active:scale-90 shadow-gi-accent p-6 rounded-md aspect-3/2 min-w-56.5 flex-col items-center gi-font"
				>
					<div className=" w-full aspect-square bg-gi-accent/0 group-hover:bg-gi-accent duration-300 rounded-full blur-3xl -mb-[100%]" />
					<img src="/GILogo.png" className="max-h-40 mb-2 -mt-2 scale-110" />
					<label className="mt-8 text-2xl">{GAME_NAMES.GI}</label>
				</div>
			</div>
			{/* <Button
				onClick={(e) => {
					const next = e.currentTarget.nextElementSibling as HTMLDivElement;
					if (next) {
						next.style.height = "18rem";
						next.style.opacity = "1";
						e.currentTarget.style.opacity = "0";
					}
				}}
				className=" fixed bottom-10"
			>
				Show Experimental Games
			</Button> */}
			<div className="flex h-72 opacity- 0 duration-300 w-5xl items-center justify-center gap-16 select-none">
				<div
					onClick={async () => {
						if (!settings.global.game) initGame("SR");
						else {
							switchGame("SR");
						}
					}}
					className="flex duration-200 group hover:-mt-2 active:scale-90 p-6 rounded-md aspect-3/2 max-w-56.5 min-h-70 flex-col items-center sr-font"
				>
					<div className=" w-full mt-2 aspect-square bg-sr-accent/0 group-hover:bg-sr-accent duration-300 rounded-full blur-3xl -mb-[100%]" />
					<img src="/SRLogo.png" className="mt-8.5 mb-12 scale-150" />
					<label className="text-2xl">{GAME_NAMES.SR}</label>
				</div>
				<div
					onClick={async () => {
						if (!settings.global.game) initGame("EF");
						else {
							switchGame("EF");
						}
					}}
					className="flex duration-200 group hover:-mt-2 active:scale-90 p-6 rounded-md aspect-3/2 max-w-56.5 min-h-70 flex-col items-center ef-font"
				>
					<div className=" w-full aspect-square bg-ef-accent/0 group-hover:bg-ef-accent duration-300 rounded-full blur-3xl -mb-[100%]" />
					<img src="/EFLogo.png" className="max-h-40 mt-5 -mb-3 scale-110" />
					<label className="mt-8 text-2xl">{GAME_NAMES.EF}</label>
				</div>
				{/* <div
					onClick={async () => {
						if (!settings.global.game) initGame("EF");
						else {
							switchGame("EF");
						}
					}}
					className="flex duration-200 group hover:-mt-2 active:scale-90 shadow-gi-accent p-6 rounded-md aspect-3/2 max-w-56.5 min-h-70 flex-col items-center ef-font"
				>
					<div className=" w-full aspect-square bg-accent/0 group-hover:bg-accent duration-300 rounded-full blur-3xl -mb-[100%]" />
					<img src="/EFLogo4.png" className="max-h-40 mt-5 -mb-3 scale-110" />
					<label className="mt-8 text-2xl">{GAME_NAMES.EF}</label>
				</div> */}
			</div>
		</div>
	);
}
export default Page2;
