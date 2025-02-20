export default function ChatPage({ params }: { params: { chatId: string } }) {
  const { chatId } = params;

  return <div className="w-full h-full">{chatId}</div>;
}
