import { Bell } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatDate, cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function NotificationBell() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: api.notifications.list,
    refetchInterval: 15000,
  });

  const unreadCount = notifications.filter((n: any) => !n.read).length;

  async function markAllRead() {
    await api.notifications.markAllRead();
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function handleNotificationClick(n: any) {
    if (!n.read) {
      await api.notifications.markRead(n.id);
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
    if (n.link) navigate(n.link);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="relative rounded-full p-2 text-gray-300 hover:bg-white/10 hover:text-white">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-brand-violet-500 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-y-auto scrollbar-thin">
          {notifications.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-gray-400">You're all caught up.</p>
          )}
          {notifications.map((n: any) => (
            <button
              key={n.id}
              onClick={() => handleNotificationClick(n)}
              className={cn(
                "block w-full px-3 py-2 text-left text-sm transition-colors",
                !n.read && "bg-brand-violet-50",
                n.link && "cursor-pointer hover:bg-gray-50",
              )}
            >
              <p className="text-gray-800">{n.message}</p>
              <p className="mt-0.5 text-xs text-gray-400">{formatDate(n.createdAt)}</p>
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
