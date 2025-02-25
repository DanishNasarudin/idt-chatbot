"use client";

import { useChat } from "@ai-sdk/react";
import type { Attachment, Message } from "ai";
import { useState } from "react";
import { useSWRConfig } from "swr";

import { cn, generateUUID } from "@/lib/utils";

import { DEFAULT_CHAT_MODEL } from "@/lib/models";
import { toast } from "sonner";
import { Messages } from "./messages";
import { MultimodalInput } from "./multimodal-input";

export function Chat({
  id,
  initialMessages,
  isReadonly,
}: {
  id: string;
  initialMessages: Array<Message>;
  isReadonly: boolean;
}) {
  const { mutate } = useSWRConfig();

  const {
    messages,
    setMessages,
    handleSubmit,
    input,
    setInput,
    append,
    isLoading,
    stop,
    reload,
  } = useChat({
    id,
    body: { id, selectedChatModel: DEFAULT_CHAT_MODEL },
    initialMessages,
    experimental_throttle: 100,
    sendExtraMessageFields: true,
    generateId: generateUUID,
    onFinish: () => {
      mutate("/api/history");
    },
    onError: (error) => {
      toast.error("An error occured, please try again!");
    },
  });

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);

  return (
    <>
      <Messages
        chatId={id}
        isLoading={isLoading}
        messages={messages}
        setMessages={setMessages}
        reload={reload}
        isReadonly={isReadonly}
      />
      <form
        className={cn(
          "sticky bg-background bottom-0 mx-auto px-4 pb-8 pt-4 gap-2 w-full md:max-w-3xl"
        )}
      >
        {!isReadonly && (
          <MultimodalInput
            chatId={id}
            input={input}
            setInput={setInput}
            handleSubmit={handleSubmit}
            isLoading={isLoading}
            stop={stop}
            attachments={attachments}
            setAttachments={setAttachments}
            messages={messages}
            setMessages={setMessages}
            append={append}
            className="bg-background!"
          />
        )}
      </form>
      <div className="sticky bottom-0 w-full mx-auto text-center py-2">
        <p className="text-muted-foreground/30 text-xs">
          © [2018-2025] IDEAL TECH PC SDN BHD 201401008251 (1084329-M). All
          Rights Reserved.
        </p>
      </div>
    </>
  );
}
