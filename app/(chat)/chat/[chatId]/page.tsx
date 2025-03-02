import { Chat } from "@/components/custom/chat";
import { DEFAULT_CHAT_MODEL } from "@/lib/models";
import { convertToUIMessages } from "@/lib/utils";
import { getChatById } from "@/services/chat";
import { getMessagesByChatId } from "@/services/message";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function ChatPage({
  params,
}: {
  params: { chatId: string };
}) {
  const { chatId } = params;

  const chat = await getChatById({ id: chatId });

  if (!chat) {
    redirect("/");
  }

  const session = await auth();

  if (chat.visibility === "PRIVATE") {
    if (!session) {
      return redirect("/");
    }

    if (session.userId !== chat.userId) {
      return redirect("/");
    }
  }

  const messagesFromDb = await getMessagesByChatId({
    id: chatId,
  });

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get("chat-model");

  if (!chatModelFromCookie) {
    return (
      <Chat
        id={chat.id}
        initialMessages={convertToUIMessages(messagesFromDb)}
        isReadonly={session.userId !== chat.userId}
        selectedChatModel={DEFAULT_CHAT_MODEL}
      />
    );
  }

  return (
    <Chat
      id={chat.id}
      initialMessages={convertToUIMessages(messagesFromDb)}
      isReadonly={session.userId !== chat.userId}
      selectedChatModel={chatModelFromCookie.value}
    />
  );
}
