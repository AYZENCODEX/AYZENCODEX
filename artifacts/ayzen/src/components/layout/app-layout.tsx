import { ReactNode, useState } from "react";
import { AppSidebar } from "./app-sidebar";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { NotificationBell } from "@/components/notification-bell";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-primary/30">
      {isMobile ? (
        <>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetContent side="left" className="p-0 w-64 border-r border-sidebar-border bg-sidebar">
              <AppSidebar onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <AppSidebar />
      )}

      <main className="flex-1 overflow-y-auto relative flex flex-col">
        <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none"
          style={{ backgroundImage: 'linear-gradient(to right, #808080 1px, transparent 1px), linear-gradient(to bottom, #808080 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        />

        {isMobile && (
          <div className="relative z-10 flex items-center gap-3 px-4 py-3 border-b border-border bg-sidebar/80 backdrop-blur-sm sticky top-0">
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(true)} className="text-primary hover:bg-primary/10">
              <Menu className="w-5 h-5" />
            </Button>
            <span className="font-mono font-bold tracking-tighter text-primary text-lg flex-1">AYZEN</span>
            <NotificationBell />
          </div>
        )}

        {!isMobile && (
          <div className="relative z-10 flex items-center justify-end px-6 py-2 border-b border-border/40 bg-background/40 backdrop-blur-sm sticky top-0">
            <NotificationBell />
          </div>
        )}

        <div className="relative z-10 p-4 md:p-6 lg:p-8 flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}
