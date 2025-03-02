import { useStartTime } from "@/lib/hooks";
import { listOfTools } from "@/lib/tools";
import { cn } from "@/lib/utils";
import { useUser } from "@clerk/nextjs";
import { Message as AIMessageType, ChatRequestOptions } from "ai";
import equal from "fast-deep-equal";
import { BotMessageSquareIcon, LoaderIcon } from "lucide-react";
import { motion } from "motion/react";
import { memo, useEffect, useMemo, useState } from "react";
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

  const hasReasoning = useMemo(
    () => message.parts?.some((part) => part.type === "reasoning") || false,
    [message, isLoading]
  );
  const reasoning = useMemo(
    () =>
      hasReasoning
        ? message.parts
            ?.map((part) => {
              if (part.type === "reasoning") return part.reasoning;
            })
            .join(" ")!
        : "",
    [hasReasoning, message, isLoading]
  );

  const hasTool = useMemo(
    () =>
      message.parts?.some((part) => part.type === "tool-invocation") || false,
    [message, isLoading]
  );

  const tool = useMemo(
    () =>
      hasTool
        ? message.parts?.map((part) => {
            if (part.type === "tool-invocation") return part.toolInvocation;
          })
        : undefined,
    [hasTool, message, isLoading]
  );

  const showTimer = hasReasoning || hasTool;
  const timerLoading =
    (hasReasoning && message.content === "") ||
    (hasTool && message.content === "");

  // console.log(hasTool, tool, message.content, "CHECK THIS");
  // if (message.role == ("tool" as any)) console.log("GOT IT");

  // if (message.role == ("tool" as any)) return null;

  // console.log(hasReasoning, hasTool && message.content === "", "CHECK TIMER");

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

        {tool && tool.length > 0 && (
          <div className="flex flex-col gap-4">
            {tool.map((toolInvocation) => {
              if (!toolInvocation) return;
              const { toolName, toolCallId, state, args } = toolInvocation;
              const toolDescription =
                `${toolName}: ${listOfTools[toolName]?.description}` ||
                `${toolName}: Getting data..`;

              if (state === "result" && message.content === "") {
                return (
                  <div key={toolCallId}>
                    <div className="flex flex-row gap-2 items-center">
                      <div className="font-medium">
                        Processing retrieved {toolName} data
                      </div>
                      <div className="animate-spin">
                        <LoaderIcon />
                      </div>
                    </div>
                  </div>
                );
              }
              if (state === "call")
                return (
                  <div key={toolCallId}>
                    <div className="flex flex-row gap-2 items-center">
                      <div className="font-medium">{toolDescription}</div>
                      <div className="animate-spin">
                        <LoaderIcon />
                      </div>
                    </div>
                  </div>
                );
              if (state === "result")
                return (
                  <div
                    key={toolCallId}
                    className="text-xs text-muted-foreground"
                  >
                    Used Function: {toolName}
                  </div>
                );
            })}
          </div>
        )}
        {showTimer && <TimerDisplay isLoading={timerLoading} />}
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
  if (prevProps.message.role !== nextProps.message.role) return false;
  if (!equal(prevProps.message.parts, nextProps.message.parts)) return false;

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

type TimerDisplayProps = {
  isLoading: boolean;
};

const TimerDisplay: React.FC<TimerDisplayProps> = ({ isLoading }) => {
  const [startTime, setStartTime] = useStartTime();
  const [elapsed, setElapsed] = useState<number>(0);

  useEffect(() => {
    if (!isLoading && startTime !== null && elapsed === 0) {
      setElapsed(Date.now() - startTime);
      setStartTime(null);
    }
  }, [isLoading, startTime, elapsed, setStartTime]);

  if (isLoading || elapsed === 0) return null;

  const totalSeconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <div className="text-xs text-muted-foreground">
      Total Processing Time:{" "}
      {minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`}
    </div>
  );
};
