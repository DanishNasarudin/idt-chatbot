import Navbar from "@/components/custom/navbar";
import Sidebar from "@/components/custom/sidebar";
import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    return notFound();
  }

  return (
    <div className="flex w-full h-full overflow-hidden">
      <Sidebar userId={session.userId!} />
      <div className="flex flex-col w-full h-full">
        <Navbar />
        <div className="p-4 w-full h-full">{children}</div>
      </div>
    </div>
  );
}
