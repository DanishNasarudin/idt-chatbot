"use client";
import { SquarePenIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "../ui/button";
import TooltipWrapper from "../utils/tooltip-wrapper";
import PanelButton from "./sidebar-openbutton";

export default function SidebarTop() {
  return (
    <div className="flex justify-between p-2 z-[1]">
      <PanelButton tooltip="Close sidebar" />
      <TooltipWrapper content="New chat">
        <Link href={"/"}>
          <Button size={"icon"} variant={"ghost"}>
            <SquarePenIcon />
          </Button>
        </Link>
      </TooltipWrapper>
    </div>
  );
}
