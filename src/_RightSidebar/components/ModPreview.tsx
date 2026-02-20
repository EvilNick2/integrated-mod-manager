// import { Button } from "@/components/ui/button";
import { DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
// import { Input } from "@/components/ui/input";
// import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
// import { saveConfigs } from "@/utils/filesys";
// import { Mod } from "@/utils/types";
// import { getImageUrl, handleImageError } from "@/utils/utils";
// import { DATA, LAST_UPDATED, MOD_LIST, TEXT_DATA } from "@/utils/vars";
// import { useAtom, useAtomValue, useSetAtom } from "jotai";
// import { InfoIcon, RefreshCcwIcon, SaveIcon, Undo2Icon } from "lucide-react";
// import { useEffect, useState } from "react";
// let overflowTimer = null as number | null;
function ModPreview({ item, setDialogType, isBlank }: { item: any, setDialogType: (type: string) => void, isBlank: boolean }) {
	console.log(item,setDialogType);
	return (
		<DialogContent className="min-w-250 select-none">
			<Tooltip>
				<TooltipTrigger></TooltipTrigger>
				<TooltipContent className="opacity-0"></TooltipContent>
			</Tooltip>

			<div className="min-h-fit text-accent text-3xl">{"Set Preview Image"}</div>
			<Input type=""
			
		</DialogContent>
	);
}

export default ModPreview;
``;
