"use client";
import { cn } from "@/lib/utils";
import { Message as AIMessageType, ChatRequestOptions } from "ai";
import equal from "fast-deep-equal";
import { BotMessageSquareIcon } from "lucide-react";
import { memo, useEffect, useRef } from "react";
import { useScrollToBottom } from "../utils/use-scroll-to-bottom";
import { Message, ThinkingMessage } from "./message";
import Placeholder from "./placeholder";

type MessagesProps = {
  chatId: string;
  isLoading: boolean;
  messages: Array<AIMessageType>;
  setMessages: (
    messages: AIMessageType[] | ((messages: AIMessageType[]) => AIMessageType[])
  ) => void;
  reload: (
    chatRequestOptions?: ChatRequestOptions
  ) => Promise<string | null | undefined>;
  isReadonly: boolean;
};

function PureMessages({
  chatId,
  isLoading,
  messages,
  setMessages,
  reload,
  isReadonly,
}: MessagesProps) {
  const [messagesContainerRef, messagesEndRef] =
    useScrollToBottom<HTMLDivElement>();
  const sectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    sectionRef.current?.scrollTo({
      top: sectionRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  return (
    <section
      ref={messagesContainerRef}
      className={cn(
        "w-full h-full mx-auto flex flex-col gap-2 overflow-y-auto relative",
        "before:w-full before:h-[80px] before:fixed before:z-[0] before:top-0 before:bg-gradient-to-b before:from-background before:to-transparent before:from-80%"
      )}
    >
      <div className="h-[8px] bg-background flex-none"></div>
      {messages && messages.length > 0 ? (
        messages.map((message, index) => {
          return (
            <Message
              key={message.id}
              chatId={chatId}
              message={message}
              isLoading={isLoading && messages.length - 1 === index}
              setMessages={setMessages}
              reload={reload}
              isReadonly={isReadonly}
            />
          );
        })
      ) : (
        <Placeholder
          icon={BotMessageSquareIcon}
          title={`Hi! I am ${"Agent"}. How can I help you today?`}
          subtitle=""
        />
      )}

      {isLoading &&
        messages.length > 0 &&
        messages[messages.length - 1].role === "user" && <ThinkingMessage />}

      <div ref={messagesEndRef} className="shrink-0 min-w-[24px] min-h-32" />
      {/* <div className="h-32 bg-background flex-none"></div> */}
    </section>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.isLoading !== nextProps.isLoading) return false;
  if (prevProps.isLoading && nextProps.isLoading) return false;
  if (prevProps.messages.length !== nextProps.messages.length) return false;
  if (!equal(prevProps.messages, nextProps.messages)) return false;

  return true;
});
