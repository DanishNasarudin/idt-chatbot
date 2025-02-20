"use client";
import { useGeneralStore } from "@/lib/zustand";
import { SquarePenIcon } from "lucide-react";
import { motion } from "motion/react";
import { Button } from "../ui/button";
import TooltipWrapper from "../utils/tooltip-wrapper";
import PanelButton from "./sidebar-openbutton";

export default function NavbarOpenButton() {
  const { navbarIsOpen } = useGeneralStore();
  return (
    <motion.div
      animate={String(navbarIsOpen)}
      variants={{
        false: { opacity: 1 },
        true: { opacity: 0, pointerEvents: "none" },
      }}
      className="flex"
    >
      <PanelButton tooltip="Open sidebar" />
      <TooltipWrapper content="New chat">
        <Button size={"icon"} variant={"ghost"}>
          <SquarePenIcon />
        </Button>
      </TooltipWrapper>
    </motion.div>
  );
}
