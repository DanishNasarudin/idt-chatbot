import { Chat } from "@/components/custom/chat";
import { generateUUID } from "@/lib/utils";

export default function Home() {
  const id = generateUUID();

  return <Chat key={id} id={id} initialMessages={[]} isReadonly={false} />;
}
