import { Input } from "@/components/ui/input";

export default function ChatLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col w-full h-full">
      {children}
      <Input className="flex-none" />
    </div>
  );
}
