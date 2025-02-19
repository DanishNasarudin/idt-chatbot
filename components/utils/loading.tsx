import { Loader2Icon } from "lucide-react";

export default function Loading({ content }: { content?: string }) {
  const development = process.env.NODE_ENV !== "production";
  return (
    <div className="flex h-full w-full items-center justify-center flex-col">
      {development && content && <p className="text-xs">{content}</p>}
      <Loader2Icon size={30} className="animate-spin stroke-primary" />
    </div>
  );
}
