import { CosmosRoom, RoomId } from "../types/room";

interface SidebarUser {
  id: string;
  displayName: string;
  roomId: RoomId;
  roomName: string;
}

interface SpaceSidebarProps {
  rooms: CosmosRoom[];
  activeRoomId: RoomId;
  users: SidebarUser[];
}

const CHANNELS = ["general-chat", "design-sync", "daily-updates"];

const getRoomCounts = (rooms: CosmosRoom[], users: SidebarUser[]): Record<RoomId, number> => {
  const counts = rooms.reduce<Record<RoomId, number>>((accumulator, room) => {
    accumulator[room.id] = 0;
    return accumulator;
  }, {} as Record<RoomId, number>);

  users.forEach((user) => {
    counts[user.roomId] += 1;
  });

  return counts;
};

export const SpaceSidebar = ({ rooms, activeRoomId, users }: SpaceSidebarProps) => {
  const roomCounts = getRoomCounts(rooms, users);

  return (
    <aside className="hidden h-full min-h-0 flex-col rounded-2xl border border-cosmos-700/60 bg-cosmos-800/45 p-3 shadow-panel xl:flex">
      <div className="mb-3 rounded-xl border border-cosmos-700/70 bg-cosmos-900/70 px-3 py-2">
        <p className="text-xs uppercase tracking-[0.18em] text-cosmos-300">Virtual Cosmos</p>
        <p className="mt-1 text-lg font-semibold text-slate-100">Workspace Deck</p>
      </div>

      <div className="rounded-xl border border-cosmos-700/70 bg-cosmos-900/70 px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-slate-200">Search Space</span>
          <span className="rounded border border-cosmos-700/70 px-1.5 py-0.5 text-[10px] text-slate-400">Ctrl K</span>
        </div>
      </div>

      <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        <section className="rounded-xl border border-cosmos-700/60 bg-cosmos-900/65 p-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Rooms</h2>
          <div className="mt-2 space-y-2">
            {rooms.map((room) => {
              const isActive = room.id === activeRoomId;
              return (
                <div
                  key={room.id}
                  className={`flex items-center justify-between rounded-lg border px-2 py-1.5 text-xs ${
                    isActive
                      ? "border-cosmos-300/80 bg-cosmos-500/20 text-cosmos-100"
                      : "border-cosmos-700/70 bg-cosmos-800/70 text-slate-300"
                  }`}
                >
                  <span className="font-semibold">{room.name}</span>
                  <span className="rounded-md border border-cosmos-700/70 px-1.5 py-0.5 text-[10px]">
                    {roomCounts[room.id] || 0}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-cosmos-700/60 bg-cosmos-900/65 p-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Channels</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-300">
            {CHANNELS.map((channel) => (
              <li key={channel} className="rounded-md px-2 py-1 transition hover:bg-cosmos-800/60">
                # {channel}
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border border-cosmos-700/60 bg-cosmos-900/65 p-3">
          <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Team Presence</h2>
          <div className="mt-2 space-y-2">
            {users.length === 0 ? <p className="text-xs text-slate-500">No active users yet.</p> : null}
            {users.map((user) => (
              <div key={user.id} className="rounded-lg border border-cosmos-700/70 bg-cosmos-800/60 px-2 py-1.5">
                <p className="text-xs font-semibold text-slate-200">{user.displayName}</p>
                <p className="text-[10px] text-slate-500">@{user.id}</p>
                <p className="text-[11px] text-slate-400">{user.roomName}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
};
