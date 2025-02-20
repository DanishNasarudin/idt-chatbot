import { useMemo } from "react";
import SidebarNavButton from "./sidebar-navbutton";
import SidebarTop from "./sidebar-top";

export default function Sidebar({
  chats,
}: {
  chats?: { name: string; chatId: string }[];
}) {
  const chatsMemo = useMemo(() => chats || [], [chats]);

  return (
    <nav className="flex flex-col max-w-[200px] w-full border-r-[1px] border-border bg-background flex-grow-0 flex-shrink-0">
      <SidebarTop />
      <div className="flex flex-col gap-2 h-full overflow-y-auto px-2">
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
    </nav>
  );
}
