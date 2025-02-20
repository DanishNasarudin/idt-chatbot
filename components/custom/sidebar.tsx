"use client";
import { cn, fetcher } from "@/lib/utils";
import { useGeneralStore } from "@/lib/zustand";
import { Chat } from "@prisma/client";
import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import SidebarNavButton from "./sidebar-navbutton";
import SidebarTop from "./sidebar-top";

export default function Sidebar({ userId }: { userId?: string }) {
  const pathname = usePathname();
  const {
    data: history,
    isLoading,
    mutate,
  } = useSWR<Array<Chat>>(userId ? "/api/history" : null, fetcher, {
    fallbackData: [],
  });

  useEffect(() => {
    mutate();
  }, [pathname, mutate]);

  const { navbarIsOpen } = useGeneralStore();

  const [isOpen, setIsOpen] = useState<boolean | null>(null);

  useEffect(() => {
    if (isOpen === null)
      setIsOpen(localStorage.getItem("navbar-isopen") === "true");
  }, []);

  const sectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    sectionRef.current?.scrollTo({
      top: -sectionRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, []);

  return (
    <motion.nav
      animate={String(navbarIsOpen)}
      variants={{
        true: { width: 200 },
        false: { width: 0 },
      }}
      initial={String(isOpen)}
      className={cn(
        navbarIsOpen ? "border-border" : "border-transparent",
        "flex flex-col max-w-[200px] w-full border-r-[1px] bg-background flex-grow-0 flex-shrink-0 overflow-hidden"
      )}
    >
      <SidebarTop />
      <div
        ref={sectionRef}
        className="flex flex-col gap-2 h-full overflow-y-auto px-4 overflow-x-hidden"
      >
        <span className="font-bold text-muted-foreground">Chats</span>
        {history &&
          history.length > 0 &&
          (history as Chat[]).map((chat) => (
            <SidebarNavButton
              key={chat.id}
              name={chat.title}
              chatId={chat.id}
            />
          ))}
        {!isLoading && history && history.length === 0 && (
          <nav className="flex flex-col w-full h-full justify-center items-center">
            <p className="text-muted-foreground">No chat history</p>
          </nav>
        )}
        {isLoading && (
          <nav className="flex flex-col w-full h-full justify-center items-center">
            <p className="text-muted-foreground">Loading chat...</p>
          </nav>
        )}
        {/* <div ref={endRef} className="shrink-0 min-w-[24px] min-h-[24px]" /> */}
      </div>
    </motion.nav>
  );
}
