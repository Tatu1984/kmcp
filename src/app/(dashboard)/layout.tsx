import * as React from "react";
import { SidebarInset, SidebarProvider } from "@/frontend/components/ui/sidebar";
import { AppSidebar } from "@/frontend/components/layout/app-sidebar";
import { AppHeader } from "@/frontend/components/layout/app-header";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset className="min-w-0 overflow-x-hidden">
        <AppHeader />
        <div className="flex-1 space-y-6 p-4 sm:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
