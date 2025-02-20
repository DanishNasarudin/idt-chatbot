import { PanelLeftCloseIcon, SquarePenIcon } from "lucide-react";
import { Button } from "../ui/button";
import TooltipWrapper from "../utils/tooltip-wrapper";

export default function SidebarTop() {
  return (
    <div className="flex justify-between p-2">
      <Button size={"icon"} variant={"ghost"}>
        <PanelLeftCloseIcon />
      </Button>
      <TooltipWrapper content="Create Agent">
        <Button size={"icon"} variant={"ghost"}>
          <SquarePenIcon />
        </Button>
      </TooltipWrapper>
    </div>
  );
}
