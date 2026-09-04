import { TicketList } from "@/components/TicketList";

export function AdminTickets() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-gray-900">Tickets</h1>
        <p className="text-sm text-gray-500">Support requests from every client, across every company.</p>
      </div>

      <TicketList viewerRole="admin" />
    </div>
  );
}
