import { cn } from "@/lib/utils";
import { useUser } from "@clerk/nextjs";
import { Message as AIMessageType, ChatRequestOptions } from "ai";
import { BotMessageSquareIcon } from "lucide-react";
import { motion } from "motion/react";
import { memo } from "react";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Markdown } from "./markdown";
import { MessageReasoning } from "./message-reasoning";

type MessageProps = {
  chatId: string;
  message: AIMessageType;
  isLoading: boolean;
  setMessages: (
    messages: AIMessageType[] | ((messages: AIMessageType[]) => AIMessageType[])
  ) => void;
  reload: (
    chatRequestOptions?: ChatRequestOptions
  ) => Promise<string | null | undefined>;
  isReadonly: boolean;
};

function PureMessage({ isLoading, message }: MessageProps) {
  const { user } = useUser();
  const userIntial =
    `${user?.firstName?.toUpperCase().split("")[0]}` +
    `${user?.lastName?.toUpperCase().split("")[0]}`;

  const hasReasoning =
    message.parts?.some((part) => part.type === "reasoning") || false;

  const reasoning = hasReasoning
    ? message.parts
        ?.map((part) => {
          if (part.type === "reasoning") return part.reasoning;
        })
        .join(" ")!
    : "";

  return (
    <div
      className={cn(
        "flex gap-4 w-full max-w-[700px] mx-auto",
        message.role === "assistant" ? "justify-start" : "justify-end"
      )}
    >
      <div className="w-[40px] flex-none">
        {message.role === "assistant" && (
          <Avatar className="w-[36px] h-[36px]">
            <AvatarFallback>
              <BotMessageSquareIcon />
            </AvatarFallback>
          </Avatar>
        )}
      </div>
      <span
        className={cn(
          "text-xs p-2 flex flex-col gap-2 justify-center w-full text-wrap",
          message.role === "user" &&
            "bg-secondary rounded-xl max-w-[60%] px-6 py-4"
        )}
      >
        {hasReasoning && reasoning.trim() !== "" && (
          <MessageReasoning isLoading={isLoading} reasoning={reasoning} />
        )}
        <Markdown>{message.content as string}</Markdown>
      </span>
      <div className="w-[40px] flex-none">
        {/* {message.role === "user" && (
          <Avatar className="w-[36px] h-[36px]">
            <AvatarImage src={user?.imageUrl} alt="user_profile" />
            <AvatarFallback className="text-xs">{userIntial}</AvatarFallback>
          </Avatar>
        )} */}
      </div>
    </div>
  );
}

export const Message = memo(PureMessage, (prevProps, nextProps) => {
  if (prevProps.isLoading !== nextProps.isLoading) return false;
  if (prevProps.message.content !== nextProps.message.content) return false;

  return true;
});

export const ThinkingMessage = () => {
  const role = "assistant";

  return (
    <motion.div
      className="w-full mx-auto max-w-3xl px-4 group/message "
      initial={{ y: 5, opacity: 0 }}
      animate={{ y: 0, opacity: 1, transition: { delay: 1 } }}
      data-role={role}
    >
      <div
        className={cn(
          "flex gap-4 w-full max-w-[700px] mx-auto",
          role === "assistant" ? "justify-start" : "justify-end"
        )}
      >
        <div className="w-[40px] flex-none">
          {role === "assistant" && (
            <Avatar className="w-[36px] h-[36px]">
              <AvatarFallback>
                <BotMessageSquareIcon />
              </AvatarFallback>
            </Avatar>
          )}
        </div>
        <span
          className={cn(
            "text-xs p-2 flex flex-col gap-2 justify-center w-full"
          )}
        >
          Thinking...
        </span>
        <div className="w-[40px] flex-none"></div>
      </div>
    </motion.div>
  );
};
