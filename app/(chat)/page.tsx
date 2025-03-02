import { Chat } from "@/components/custom/chat";
import { DEFAULT_CHAT_MODEL } from "@/lib/models";
import { generateUUID } from "@/lib/utils";
import { cookies } from "next/headers";

export default async function Home() {
  const id = generateUUID();

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get("chat-model");

  if (!chatModelFromCookie)
    return (
      <Chat
        key={id}
        id={id}
        initialMessages={[]}
        isReadonly={false}
        selectedChatModel={DEFAULT_CHAT_MODEL}
      />
    );

  return (
    <Chat
      key={id}
      id={id}
      initialMessages={[]}
      isReadonly={false}
      selectedChatModel={chatModelFromCookie.value}
    />
  );
}
