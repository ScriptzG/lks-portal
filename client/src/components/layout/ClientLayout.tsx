import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { NotificationBell } from "@/components/NotificationBell";
import { BrandLogo } from "@/components/BrandLogo";
import { GlassBackground } from "@/components/GlassBackground";
import { ClientOnboardingTour } from "@/components/ClientOnboardingTour";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/portal", label: "Dashboard", end: true },
  { to: "/portal/messages", label: "Messages" },
  { to: "/portal/tickets", label: "Support" },
  { to: "/portal/documents", label: "Documents" },
  { to: "/portal/extras", label: "Extras" },
  { to: "/portal/account", label: "Account" },
];

export function ClientLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <ClientOnboardingTour />
      <header className="relative overflow-hidden bg-black text-white">
        <GlassBackground />
        <div className="relative z-10 border-b border-white/10 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                {user?.company?.logoUrl ? (
                  <img src={user.company.logoUrl} alt={user.company.name} className="h-8 w-8 shrink-0 rounded-lg object-cover" />
                ) : (
                  <BrandLogo size="sm" className="shadow-glow" />
                )}
                <div>
                  <p className="font-display text-sm font-semibold leading-tight">
                    {user?.company?.name ?? "LKS Systems"}
                  </p>
                  <p className="text-[11px] text-gray-400">Client Portal</p>
                </div>
              </div>
              <nav className="hidden items-center gap-1 sm:flex">
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        "rounded-lg px-3 py-1.5 text-sm font-medium text-gray-300 transition-all hover:bg-white/10 hover:text-white",
                        isActive && "bg-brand-violet-600 text-white shadow-glow hover:bg-brand-violet-600",
                      )
                    }
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>
            </div>
            <div className="flex items-center gap-3">
              <NotificationBell />
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Log out</span>
              </button>
            </div>
          </div>
          {/* Below sm breakpoint the header nav is hidden for space — mirror it here so
              "Account" (and any future nav item) stays reachable on mobile. */}
          <nav className="flex items-center gap-1 border-t border-white/10 px-4 py-2 sm:hidden">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "rounded-lg px-3 py-1.5 text-sm font-medium text-gray-300 hover:bg-white/10 hover:text-white",
                    isActive && "bg-brand-violet-600 text-white hover:bg-brand-violet-600",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <Outlet />
      </main>
    </div>
  );
}
