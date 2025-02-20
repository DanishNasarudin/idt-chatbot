"use client";

import { useGeneralStore } from "@/lib/zustand";
import { PanelLeftCloseIcon, PanelRightCloseIcon } from "lucide-react";
import { useEffect } from "react";
import { Button } from "../ui/button";
import TooltipWrapper from "../utils/tooltip-wrapper";

export default function PanelButton({ tooltip }: { tooltip?: string }) {
  const { setNavbarIsOpenLocaleStore, setNavbarIsOpen, navbarIsOpen } =
    useGeneralStore();

  useEffect(() => {
    if (navbarIsOpen !== undefined) return;
    const storage = localStorage.getItem("navbar-isopen");
    if (storage) {
      setNavbarIsOpenLocaleStore(Boolean(storage));
    }
  }, []);

  useEffect(() => {
    const storage = localStorage.getItem("navbar-isopen");
    if (!storage || storage !== String(navbarIsOpen)) {
      localStorage.setItem("navbar-isopen", String(navbarIsOpen));
    }
  }, [navbarIsOpen]);

  return (
    <TooltipWrapper content={tooltip ? tooltip : "Sidebar"}>
      <Button
        size={"icon"}
        variant={"ghost"}
        onClick={() => {
          setNavbarIsOpen();
        }}
      >
        {navbarIsOpen ? <PanelLeftCloseIcon /> : <PanelRightCloseIcon />}
      </Button>
    </TooltipWrapper>
  );
}
