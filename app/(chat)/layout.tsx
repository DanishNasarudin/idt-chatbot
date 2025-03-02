import Navbar from "@/components/custom/navbar";
import Sidebar from "@/components/custom/sidebar";
import { DEFAULT_CHAT_MODEL } from "@/lib/models";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    return notFound();
  }

  const cookieStore = await cookies();
  const chatModelFromCookie = cookieStore.get("chat-model");

  if (!chatModelFromCookie) {
    return (
      <div className="flex w-full h-full overflow-hidden">
        <Sidebar userId={session.userId!} />
        <div className="flex flex-col w-full h-full">
          <Navbar selectedChatModel={DEFAULT_CHAT_MODEL} />
          <div className="p-4 w-full h-full">{children}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex w-full h-full overflow-hidden">
      <Sidebar userId={session.userId!} />
      <div className="flex flex-col w-full h-full">
        <Navbar selectedChatModel={chatModelFromCookie.value} />
        <div className="p-4 w-full h-full">{children}</div>
      </div>
    </div>
  );
}
