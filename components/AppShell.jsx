"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";

const TITLES = {
  dashboard: "Dashboard",
  clients: "Clients",
  schedule: "Schedule",
  settings: "Settings",
};

export default function AppShell({ active, children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const title = useMemo(() => TITLES[active] || "Dashboard", [active]);
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        active={active}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav
          title={title}
          onToggleSidebar={() => setCollapsed((prev) => !prev)}
          onOpenMobile={() => setMobileOpen(true)}
        />

        <main className="flex-1 px-6 py-6 sm:px-8">
          <div key={pathname} className="page-transition">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
