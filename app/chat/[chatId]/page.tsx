import type { CoreMessage } from "ai";

export default function ChatPage({ params }: { params: { chatId: string } }) {
  const { chatId } = params;

  const messages: CoreMessage[] = [
    { role: "system", content: "You are a chatbot." },
    { role: "user", content: "Hi there." },
    { role: "assistant", content: "Hello!!" },
  ];

  return <div className="w-full h-full">{chatId}</div>;
}
