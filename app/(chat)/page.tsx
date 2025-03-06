import Chat from "@/components/custom/chat";
import { DEFAULT_CHAT_MODEL } from "@/lib/models";
import { generateUUID } from "@/lib/utils";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Home() {
  const id = generateUUID();

  const session = await auth();

  if (!session) {
    console.log("not authorised");
    return redirect("/");
  }

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get("chat-model");

  if (!chatModelFromCookie)
    return (
      <Chat
        key={id}
        id={id}
        initialMessages={[]}
        isReadonly={session.userId ? false : true}
        selectedChatModel={DEFAULT_CHAT_MODEL}
      />
    );

  return (
    <Chat
      key={id}
      id={id}
      initialMessages={[]}
      isReadonly={session.userId ? false : true}
      selectedChatModel={chatModelFromCookie.value}
    />
  );
}
