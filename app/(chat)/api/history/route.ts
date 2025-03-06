import { getChatsByUserId } from "@/services/chat";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  const session = await auth();

  if (!session || !session.userId) {
    return Response.json("Unauthorized!", { status: 401 });
  }

  // biome-ignore lint: Forbidden non-null assertion.
  const chats = await getChatsByUserId({ id: session.userId! });

  return Response.json(chats);
}
