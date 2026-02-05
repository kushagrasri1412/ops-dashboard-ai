"use client";

import { Menu, PanelLeft } from "lucide-react";

export default function TopNav({ title, onToggleSidebar, onOpenMobile }) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="flex items-center justify-between gap-3 px-6 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobile}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onToggleSidebar}
            className="hidden rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:inline-flex"
            aria-label="Collapse sidebar"
          >
            <PanelLeft className="h-5 w-5" />
          </button>
          <div>
            <p className="text-sm font-semibold text-slate-900">{title}</p>
            <p className="text-xs text-slate-500">
              Restaurant digital operations overview
            </p>
          </div>
        </div>

        <div className="hidden items-center gap-2 sm:flex">
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-600">
            <span className="font-semibold text-slate-900">Live</span> data
          </div>
        </div>
      </div>
    </header>
  );
}
