import { cn } from "@/lib/utils";
import { Message as AIMessageType, ChatRequestOptions } from "ai";
import { BotMessageSquareIcon } from "lucide-react";
import { motion } from "motion/react";
import { memo } from "react";
import ReactMarkdown from "react-markdown";
import { Avatar, AvatarFallback } from "../ui/avatar";

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

function PureMessage({ chatId, message }: MessageProps) {
  message.role;
  return (
    <div
      className={cn(
        "flex gap-4 w-full max-w-[640px] mx-auto",
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
          "text-xs p-2 flex flex-col gap-2 justify-center w-full",
          message.role === "user" &&
            "bg-secondary rounded-lg max-w-[60%] px-6 py-4"
        )}
      >
        <ReactMarkdown>{message.content}</ReactMarkdown>
      </span>
      <div className="w-[40px] flex-none"></div>
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
          "flex gap-4 w-full max-w-[640px] mx-auto",
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
