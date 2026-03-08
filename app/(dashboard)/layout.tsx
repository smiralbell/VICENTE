import Sidebar from "@/components/Sidebar";
import MainContent from "@/components/MainContent";
import { SidebarProvider } from "@/components/SidebarContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <div className="flex h-screen min-h-screen bg-paper overflow-hidden">
        <Sidebar />
        <MainContent>{children}</MainContent>
      </div>
    </SidebarProvider>
  );
}
