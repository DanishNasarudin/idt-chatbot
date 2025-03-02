"use client";
import { useGeneralStore } from "@/lib/zustand";
import { SquarePenIcon } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { Button } from "../ui/button";
import TooltipWrapper from "../utils/tooltip-wrapper";
import PanelButton from "./sidebar-openbutton";

export default function NavbarOpenButton() {
  const { navbarIsOpen } = useGeneralStore();
  return (
    <motion.div
      animate={String(navbarIsOpen)}
      variants={{
        false: { opacity: 1, position: "static" },
        true: { opacity: 0, pointerEvents: "none", position: "absolute" },
      }}
      initial={{ opacity: 0, position: "absolute" }}
      className="flex"
    >
      <PanelButton tooltip="Open sidebar" />
      <TooltipWrapper content="New chat">
        <Link href={"/"}>
          <Button size={"icon"} variant={"ghost"}>
            <SquarePenIcon />
          </Button>
        </Link>
      </TooltipWrapper>
    </motion.div>
  );
}
