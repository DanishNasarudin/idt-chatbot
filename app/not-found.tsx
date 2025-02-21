import { Button } from "@/components/ui/button";
import Link from "next/link";

const NotFound = () => {
  return (
    <div className="w-full h-full flex flex-col gap-2 justify-center items-center">
      <h2 className="font-bold text-lg">Not Found</h2>
      <p>Please Navigate Back to Home</p>
      <Link href={"/"}>
        <Button>Return Home</Button>
      </Link>
    </div>
  );
};

export default NotFound;
