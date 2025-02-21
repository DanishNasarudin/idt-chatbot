import { Chat } from "@/components/custom/chat";
import { convertToUIMessages } from "@/lib/utils";
import { getChatById } from "@/services/chat";
import { getMessagesByChatId } from "@/services/message";
import { auth } from "@clerk/nextjs/server";
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

  return (
    <Chat
      id={chat.id}
      initialMessages={convertToUIMessages(messagesFromDb)}
      isReadonly={session.userId !== chat.userId}
    />
  );
}
