"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  LayoutDashboard,
  Settings,
  Users,
  X,
} from "lucide-react";

const NAV_ITEMS = [
  {
    id: "dashboard",
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  { id: "clients", href: "/clients", label: "Clients", icon: Users },
  { id: "schedule", href: "/schedule", label: "Schedule", icon: Calendar },
  { id: "settings", href: "/settings", label: "Settings", icon: Settings },
];

function NavLink({ href, label, Icon, active, collapsed, onNavigate }) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      title={collapsed ? label : undefined}
      className={
        "group flex items-center rounded-xl text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30 " +
        (collapsed ? "justify-center px-2 py-2 " : "gap-3 px-3 py-2 ") +
        (active
          ? "bg-slate-100 text-slate-900"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900")
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span
        className={
          "truncate transition-opacity lg:opacity-100" +
          (collapsed ? " lg:opacity-0 lg:w-0 lg:overflow-hidden" : "")
        }
      >
        {label}
      </span>
    </Link>
  );
}

export default function Sidebar({
  active,
  collapsed,
  mobileOpen,
  onCloseMobile,
}) {
  const pathname = usePathname();

  return (
    <>
      <div
        className={
          "fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm transition-opacity lg:hidden " +
          (mobileOpen ? "opacity-100" : "pointer-events-none opacity-0")
        }
        aria-hidden={mobileOpen ? "false" : "true"}
        onClick={onCloseMobile}
      />

      <aside
        className={
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-200 bg-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 " +
          (collapsed ? "lg:w-20 " : "lg:w-72 ") +
          (mobileOpen ? "translate-x-0" : "-translate-x-full")
        }
      >
        <div className="flex items-center justify-between gap-3 px-4 py-4">
          <div
            className={
              "flex items-center gap-3 overflow-hidden transition-all " +
              (collapsed ? "lg:w-12" : "lg:w-full")
            }
          >
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-sm font-semibold text-white shadow-sm">
              DO
            </div>
            <div
              className={
                "flex flex-col transition-opacity lg:opacity-100" +
                (collapsed ? " lg:opacity-0 lg:w-0 lg:overflow-hidden" : "")
              }
            >
              <span className="text-sm font-semibold text-slate-900">
                Digital Ops
              </span>
              <span className="text-xs text-slate-500">
                Restaurant channels
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className={"flex-1 space-y-1 pb-6 " + (collapsed ? "px-2" : "px-3")}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.id}
              href={item.href}
              label={item.label}
              Icon={item.icon}
              collapsed={collapsed}
              active={pathname === item.href || active === item.id}
              onNavigate={onCloseMobile}
            />
          ))}
        </nav>

        <div
          className={
            "mx-3 mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600" +
            (collapsed ? " lg:hidden" : "")
          }
        >
          <p className="font-semibold text-slate-900">AI Ops Copilot</p>
          <p className="mt-1 leading-relaxed">
            Ask about revenue anomalies and get suggested actions.
          </p>
        </div>
      </aside>
    </>
  );
}
