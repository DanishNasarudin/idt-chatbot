import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/utils/theme-toggle";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { LogInIcon } from "lucide-react";

export default function Home() {
  return (
    <div className="grid grid-rows-[20px_1fr_20px] items-center justify-items-center min-h-screen p-8 pb-20 gap-16 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <SignedOut>
        <Button variant={"outline"} size={"icon"}>
          <LogInIcon />
        </Button>
      </SignedOut>
      <SignedIn>
        <UserButton />
      </SignedIn>
      <ModeToggle />
    </div>
  );
}
