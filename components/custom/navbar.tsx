import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { LogInIcon } from "lucide-react";
import { Button } from "../ui/button";
import { ModeToggle } from "../utils/theme-toggle";

export default function Navbar() {
  return (
    <nav className="flex gap-2 w-full justify-end py-2 px-4">
      <ModeToggle />
      <SignedOut>
        <Button variant={"outline"} size={"icon"}>
          <LogInIcon />
        </Button>
      </SignedOut>
      <SignedIn>
        <UserButton />
      </SignedIn>
    </nav>
  );
}
