"use client";
import { cn } from "@/lib/utils";
import { useGeneralStore } from "@/lib/zustand";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import SidebarNavButton from "./sidebar-navbutton";
import SidebarTop from "./sidebar-top";

export default function Sidebar({
  chats,
}: {
  chats?: { name: string; chatId: string }[];
}) {
  const chatsMemo = useMemo(() => chats || [], [chats]);

  const { navbarIsOpen } = useGeneralStore();

  const [isOpen, setIsOpen] = useState<boolean | null>(null);

  useEffect(() => {
    setIsOpen(localStorage.getItem("navbar-isopen") === "true");
  }, []);

  if (navbarIsOpen === undefined) return null;

  return (
    <motion.nav
      animate={String(navbarIsOpen)}
      variants={{
        true: { width: 200 },
        false: { width: 0 },
      }}
      initial={String(isOpen)}
      className={cn(
        "flex flex-col max-w-[200px] w-full border-r-[1px] border-border bg-background flex-grow-0 flex-shrink-0 overflow-hidden"
      )}
    >
      <SidebarTop />
      <div className="flex flex-col gap-2 h-full overflow-y-auto px-2 overflow-x-hidden">
        <span className="font-bold text-muted-foreground">Chats</span>
        {chatsMemo.length > 0 &&
          chatsMemo.map((chat) => (
            <SidebarNavButton
              key={chat.chatId}
              name={chat.name}
              chatId={chat.chatId}
            />
          ))}
        {chatsMemo.length === 0 && (
          <nav className="flex flex-col w-full h-full justify-center items-center">
            <p className="text-muted-foreground">No chat history</p>
          </nav>
        )}
      </div>
    </motion.nav>
  );
}
