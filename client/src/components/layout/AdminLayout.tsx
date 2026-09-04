import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LayoutDashboard, Building2, Globe2, CreditCard, Settings, LogOut, LifeBuoy, Sparkles, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { NotificationBell } from "@/components/NotificationBell";
import { BrandLogo } from "@/components/BrandLogo";
import { GlassBackground } from "@/components/GlassBackground";
import { CommandPalette } from "@/components/CommandPalette";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/companies", label: "Companies", icon: Building2 },
  { to: "/admin/websites", label: "Websites", icon: Globe2 },
  { to: "/admin/billing", label: "Billing", icon: CreditCard },
  { to: "/admin/tickets", label: "Tickets", icon: LifeBuoy },
  { to: "/admin/extras", label: "Extras", icon: Sparkles },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <CommandPalette />
      {/* The gradient lives inside the sidebar's own box (not `fixed` to the viewport) so it
          scrolls and clips naturally with the sidebar — a viewport-fixed layer here would bleed
          through the content area on any horizontal scroll (e.g. narrow viewports where this
          unresponsive-width sidebar forces overflow). */}
      <aside className="relative flex w-60 shrink-0 flex-col overflow-hidden border-r border-white/10 bg-black text-white">
        <GlassBackground />
        <div className="relative z-10 flex items-center gap-2 px-5 py-6">
          <BrandLogo size="sm" className="shadow-glow" />
          <div>
            <p className="font-display text-sm font-semibold leading-tight">LKS Systems</p>
            <p className="text-[11px] text-gray-400">Client Portal · Admin</p>
          </div>
        </div>
        <nav className="relative z-10 flex flex-1 flex-col gap-1 px-3">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-300 transition-all hover:bg-white/10 hover:text-white",
                  isActive && "bg-brand-violet-600 text-white shadow-glow hover:bg-brand-violet-600",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="relative z-10 border-t border-white/10 px-3 py-4">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </aside>

      <div className="relative z-10 flex flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b border-white/10 bg-black/40 px-6 text-white backdrop-blur-xl">
          <button
            onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <Search className="h-3.5 w-3.5" />
            Search…
            <kbd className="ml-4 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium">⌘K</kbd>
          </button>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <div className="h-6 w-px bg-white/10" />
            <span className="text-sm text-gray-300">{user?.email}</span>
          </div>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
