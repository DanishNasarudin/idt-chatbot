import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { LogInIcon } from "lucide-react";
import { Button } from "../ui/button";
import { ModeToggle } from "../utils/theme-toggle";
import NavbarOpenButton from "./navbar-openbutton";

export default function Navbar() {
  return (
    <nav className="flex gap-2 w-full justify-between p-2 z-[1]">
      <NavbarOpenButton />
      <div className="flex gap-2 w-full justify-end pr-2">
        <ModeToggle />
        <SignedOut>
          <Button variant={"outline"} size={"icon"}>
            <LogInIcon />
          </Button>
        </SignedOut>
        <SignedIn>
          <UserButton />
        </SignedIn>
      </div>
    </nav>
  );
}
