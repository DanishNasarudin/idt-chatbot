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

  //   console.log(isLoading, "LOADING?");

  return (
    <section
      ref={sectionRef}
      className={cn(
        "w-full h-full mx-auto flex flex-col gap-2 overflow-y-auto relative"
      )}
    >
      <div className="h-[8px] bg-background flex-none"></div>
      {messages && messages.length > 0 ? (
        messages.map((message, index) => {
          const messageContent = message.content.trim();
          const hasIncompleteReasoning =
            message.parts?.some(
              (part) => part.type === "reasoning" && messageContent === ""
            ) || false;

          //   console.log(hasIncompleteReasoning, "CHECK");

          return (
            <div key={message.id}>
              <Message
                chatId={chatId}
                message={message}
                isLoading={hasIncompleteReasoning}
                setMessages={setMessages}
                reload={reload}
                isReadonly={isReadonly}
              />
            </div>
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

      <div className="shrink-0 min-w-[24px] min-h-64" />
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
