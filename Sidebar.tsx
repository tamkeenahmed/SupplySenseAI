"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Brain, FileText, Activity, AlertTriangle,
  BarChart3, RotateCcw, Settings, User, LogOut, Upload, X, TrendingUp, ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_MAIN = [
  { label: "Dashboard",  href: "/dashboard",            icon: LayoutDashboard },
  { label: "AI Insights",href: "/dashboard/insights",   icon: Brain,        badge: "New" },
  { label: "Validation", href: "/dashboard/validation", icon: ShieldCheck,  badge: "Phase 13" },
  { label: "Reports",    href: "/dashboard/reports",    icon: FileText },
];

const NAV_ANALYTICS = [
  { label: "Health Score", icon: Activity,      href: "/dashboard/health-score" },
  { label: "Risk Heatmap", icon: AlertTriangle, href: "/dashboard/risk-heatmap" },
  { label: "ABC Analysis", icon: BarChart3,     href: "/dashboard/abc-analysis" },
  { label: "Turnover",     icon: RotateCcw,     href: "/dashboard/turnover" },
  { label: "Fin. Impact",  icon: TrendingUp,    href: "/dashboard/financial-impact" },
];

interface SidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside className={cn(
        "fixed top-0 left-0 h-full w-44 z-50 flex flex-col",
        "bg-[#0f172a] border-r border-white/6",
        "transition-transform duration-200",
        "lg:translate-x-0 lg:static lg:z-auto",
        open ? "translate-x-0" : "-translate-x-full"
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-4 h-[46px] border-b border-white/5 flex-shrink-0">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#6366f1] flex items-center justify-center flex-shrink-0">
              <span className="text-white text-[10px] font-bold" style={{ fontFamily: "Syne, sans-serif" }}>S</span>
            </div>
            <span className="text-xs font-semibold text-white leading-tight" style={{ fontFamily: "Syne, sans-serif" }}>
              SupplySense AI
            </span>
          </Link>
          <button
            onClick={onClose}
            className="lg:hidden text-slate-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-5">
          {/* Main */}
          <div>
            <p className="px-2 mb-1.5 text-[10px] font-medium text-slate-600 uppercase tracking-widest">
              Main
            </p>
            <ul className="space-y-0.5">
              {NAV_MAIN.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors",
                        active
                          ? "bg-[#6366f1]/15 text-[#818cf8] border border-[#6366f1]/20"
                          : "text-slate-400 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                        {item.label}
                      </span>
                      {item.badge && (
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                          item.badge === "Phase 13"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-red-500/20 text-red-400"
                        }`}>
                          {item.badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Analytics */}
          <div>
            <p className="px-2 mb-1.5 text-[10px] font-medium text-slate-600 uppercase tracking-widest">
              Analytics
            </p>
            <ul className="space-y-0.5">
              {NAV_ANALYTICS.map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors",
                        active
                          ? "bg-[#6366f1]/15 text-[#818cf8] border border-[#6366f1]/20"
                          : "text-slate-400 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Settings */}
          <div>
            <p className="px-2 mb-1.5 text-[10px] font-medium text-slate-600 uppercase tracking-widest">
              Settings
            </p>
            <ul className="space-y-0.5">
              {[
                { label: "Policy",       icon: Settings, href: "/settings" },
                { label: "Preferences",  icon: Settings, href: "/dashboard/preferences" },
                { label: "Account",      icon: User,     href: "/dashboard/preferences" },
              ].map((item) => {
                const active = pathname === item.href;
                return (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors",
                        active
                          ? "bg-[#6366f1]/15 text-[#818cf8] border border-[#6366f1]/20"
                          : "text-slate-400 hover:bg-white/5 hover:text-white"
                      )}
                    >
                      <item.icon className="w-3.5 h-3.5 flex-shrink-0" />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </nav>

        {/* Bottom: New upload */}
        <div className="px-2 py-3 border-t border-white/5 space-y-2">
          <Link
            href="/upload"
            className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-white bg-[#6366f1] hover:bg-[#4f46e5] transition-colors"
          >
            <Upload className="w-3.5 h-3.5" />
            New upload
          </Link>
          <button className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-slate-500 hover:text-white hover:bg-white/5 transition-colors">
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
