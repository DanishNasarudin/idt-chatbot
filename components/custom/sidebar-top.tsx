"use client";
import { SquarePenIcon } from "lucide-react";
import { Button } from "../ui/button";
import TooltipWrapper from "../utils/tooltip-wrapper";
import PanelButton from "./sidebar-openbutton";

export default function SidebarTop() {
  return (
    <div className="flex justify-between p-2">
      <PanelButton tooltip="Close sidebar" />
      <TooltipWrapper content="New chat">
        <Button size={"icon"} variant={"ghost"}>
          <SquarePenIcon />
        </Button>
      </TooltipWrapper>
    </div>
  );
}
