import { ReactNode } from "react";
import { AppSidebar } from "./app-sidebar";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-primary/30">
      <AppSidebar />
      <main className="flex-1 overflow-y-auto relative">
        {/* Subtle grid pattern background for the hacker vibe */}
        <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" 
             style={{ backgroundImage: 'linear-gradient(to right, #808080 1px, transparent 1px), linear-gradient(to bottom, #808080 1px, transparent 1px)', backgroundSize: '40px 40px' }} 
        />
        <div className="relative z-10 p-6 md:p-8 min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
