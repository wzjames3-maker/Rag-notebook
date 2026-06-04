import { SessionProvider } from "next-auth/react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Header } from "@/components/layout/header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { BuildProgressBanner } from "@/components/knowledge/build-progress-banner";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          {/* Desktop sidebar */}
          <div className="hidden lg:block">
            <AppSidebar />
          </div>

          {/* Main content area */}
          <div className="flex flex-1 flex-col pb-14 lg:pb-0">
            <Header />
            <BuildProgressBanner />
            <main className="flex-1 overflow-y-auto p-4 lg:p-6">
              {children}
            </main>
          </div>
        </div>

        {/* Mobile bottom nav */}
        <MobileNav />
      </SidebarProvider>
    </SessionProvider>
  );
}
