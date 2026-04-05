import { ChatMessage } from "../types/chat";
import { MessageInput } from "./MessageInput";
import { MessageList } from "./MessageList";

interface ChatPanelProps {
  connectedPeers: string[];
  activePeerId: string | null;
  selfUserId: string | null;
  messages: ChatMessage[];
  onActivePeerChange: (peerId: string) => void;
  onSendMessage: (text: string) => void;
}

export const ChatPanel = ({
  connectedPeers,
  activePeerId,
  selfUserId,
  messages,
  onActivePeerChange,
  onSendMessage,
}: ChatPanelProps) => {
  if (connectedPeers.length === 0) {
    return (
      <section className="flex h-full min-h-0 flex-col rounded-2xl border border-cosmos-700/50 bg-cosmos-800/40 p-4 shadow-panel">
        <h2 className="text-lg font-semibold text-slate-100">Proximity Chat</h2>
        <p className="mt-2 text-sm text-slate-400">Move close to another user to enable chat.</p>
      </section>
    );
  }

  return (
    <section className="flex h-full min-h-0 flex-col rounded-2xl border border-cosmos-700/50 bg-cosmos-800/40 p-4 shadow-panel">
      <h2 className="text-lg font-semibold text-slate-100">Proximity Chat</h2>

      <div className="mt-3 flex flex-wrap gap-2">
        {connectedPeers.map((peerId) => (
          <button
            key={peerId}
            onClick={() => onActivePeerChange(peerId)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-wide transition ${
              activePeerId === peerId
                ? "border-cosmos-300 bg-cosmos-500/30 text-cosmos-300"
                : "border-cosmos-700/70 bg-cosmos-900/70 text-slate-300 hover:border-cosmos-500"
            }`}
          >
            {peerId}
          </button>
        ))}
      </div>

      <div className="mt-3 min-h-0 flex-1">
        <MessageList messages={messages} selfUserId={selfUserId} />
      </div>

      <MessageInput disabled={!activePeerId} onSend={onSendMessage} />
    </section>
  );
};
