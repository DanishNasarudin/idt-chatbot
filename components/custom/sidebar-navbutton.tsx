"use client";
import { cn } from "@/lib/utils";
import { EllipsisIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Input } from "../ui/input";

export default function SidebarNavButton({
  name,
  chatId,
}: {
  name?: string;
  chatId?: string;
}) {
  if (!chatId) return null;
  const router = useRouter();
  const pathname = usePathname();

  const handleDelete = useCallback(() => {
    //   toast.loading("Deleting chat...", { id: "delete-chat" });
    //   mutateDeleteChat({ chatId: chat.id });
  }, []);

  const [renameActive, setRenameActive] = useState(false);
  const [renameValue, setRenameValue] = useState(name || "");
  const renameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (renameActive && renameRef.current) {
      setTimeout(() => {
        renameRef.current?.focus();
      }, 200);
    }
  }, [renameActive]);

  const handleRename = useCallback(() => {
    // toast.loading("Renaming chat...", { id: "rename-chat" });
    //   mutateRenameChat({ chatId: chat.id, rename: renameValue });
    setRenameActive(false);
  }, [renameValue, setRenameActive]);
  return (
    <Link
      href={`/chat/${chatId}`}
      className={cn(
        buttonVariants({
          variant: pathname === `/chat/${chatId}` ? "secondary" : "outline",
          size: "sm",
        }),
        "relative justify-start flex-shrink-0 truncate group/chatButton"
      )}
    >
      {renameActive ? (
        <Input
          className="w-full text-xs px-0 !ring-0 !outline-none !border-none"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={handleRename}
          onKeyDown={(e) => e.key === "Enter" && handleRename()}
          ref={renameRef}
        />
      ) : (
        renameValue
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size={"sm"}
            variant={"ghost"}
            className={cn(
              "absolute top-[50%] translate-y-[-50%] right-0 !outline-none !ring-0 transition-colors",
              pathname === `/chat/${chatId}`
                ? "!bg-secondary"
                : "bg-gradient-to-l from-background to-transparent from-70% hover:from-secondary group-hover/chatButton:from-secondary"
            )}
          >
            <EllipsisIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right">
          <DropdownMenuItem
            onClick={() => setRenameActive(true)}
            // disabled={isPendingRenameChat}
          >
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            className={cn("!text-destructive")}
            onClick={handleDelete}
            // disabled={isPendingDeleteChat}
          >
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Link>
  );
}
