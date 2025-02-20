import SidebarTop from "./sidebar-top";

export default function Sidebar() {
  return (
    <nav className="flex flex-col max-w-[200px] w-full border-r-[1px] border-border bg-background">
      <SidebarTop />
      <div>main</div>
    </nav>
  );
}
