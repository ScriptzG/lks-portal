import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search, Building2, Globe2, LayoutDashboard, CreditCard, LifeBuoy, Sparkles, Settings, CornerDownLeft } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

interface Item {
  id: string;
  label: string;
  sublabel?: string;
  icon: typeof Building2;
  to: string;
  group: string;
}

const STATIC_ITEMS: Item[] = [
  { id: "nav-dashboard", label: "Dashboard", icon: LayoutDashboard, to: "/admin", group: "Go to" },
  { id: "nav-companies", label: "Companies", icon: Building2, to: "/admin/companies", group: "Go to" },
  { id: "nav-websites", label: "Websites", icon: Globe2, to: "/admin/websites", group: "Go to" },
  { id: "nav-billing", label: "Billing", icon: CreditCard, to: "/admin/billing", group: "Go to" },
  { id: "nav-tickets", label: "Tickets", icon: LifeBuoy, to: "/admin/tickets", group: "Go to" },
  { id: "nav-extras", label: "Extras", icon: Sparkles, to: "/admin/extras", group: "Go to" },
  { id: "nav-settings", label: "Settings", icon: Settings, to: "/admin/settings", group: "Go to" },
];

/** Cmd/Ctrl+K quick nav across companies, websites, and admin pages — searches locally against
 * data already fetched for the Companies/Websites list pages, so opening the palette never fires
 * its own network request beyond the ones those pages already make (React Query dedupes it). */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const { data: companies } = useQuery({ queryKey: ["companies"], queryFn: () => api.companies.list(), enabled: open });
  const { data: websites } = useQuery({ queryKey: ["websites"], queryFn: () => api.websites.list(), enabled: open });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    // Lets the header's visible "Search" button open the same palette, without wiring a
    // context/prop just for this — a plain DOM event is enough for a single global trigger.
    function onOpenRequest() {
      setOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("open-command-palette", onOpenRequest);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("open-command-palette", onOpenRequest);
    };
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const items = useMemo<Item[]>(() => {
    const companyItems: Item[] = (companies ?? []).map((c: any) => ({
      id: `company-${c.id}`,
      label: c.name,
      sublabel: c.industry ?? undefined,
      icon: Building2,
      to: `/admin/companies/${c.id}`,
      group: "Companies",
    }));
    const websiteItems: Item[] = (websites ?? []).map((w: any) => ({
      id: `website-${w.id}`,
      label: w.name,
      sublabel: w.company?.name,
      icon: Globe2,
      to: `/admin/websites/${w.id}`,
      group: "Websites",
    }));
    return [...STATIC_ITEMS, ...companyItems, ...websiteItems];
  }, [companies, websites]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q) || i.sublabel?.toLowerCase().includes(q));
  }, [items, query]);

  function go(item: Item) {
    navigate(item.to);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[activeIndex]) go(filtered[activeIndex]);
    }
  }

  let groupSeen = "";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out" />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-1/2 top-[18vh] z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-lifted focus:outline-none",
            "data-[state=open]:animate-sheet-in data-[state=closed]:animate-sheet-out",
          )}
        >
          <DialogPrimitive.Title className="sr-only">Quick search</DialogPrimitive.Title>
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
            <Search className="h-4 w-4 shrink-0 text-gray-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Search companies, websites, or jump to a page…"
              className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
            />
            <kbd className="shrink-0 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-400">
              esc
            </kbd>
          </div>
          <div className="max-h-80 overflow-y-auto scrollbar-thin p-1.5">
            {filtered.length === 0 && <p className="px-3 py-6 text-center text-sm text-gray-400">No matches.</p>}
            {filtered.map((item, index) => {
              const showGroup = item.group !== groupSeen;
              groupSeen = item.group;
              const Icon = item.icon;
              return (
                <div key={item.id}>
                  {showGroup && (
                    <p className="px-2.5 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{item.group}</p>
                  )}
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => go(item)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm",
                      index === activeIndex ? "bg-brand-violet-50 text-brand-violet-700" : "text-gray-700",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-gray-400" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.sublabel && <span className="shrink-0 truncate text-xs text-gray-400">{item.sublabel}</span>}
                    {index === activeIndex && <CornerDownLeft className="h-3 w-3 shrink-0 text-brand-violet-400" />}
                  </button>
                </div>
              );
            })}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
