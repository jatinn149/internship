import { ChatMessage } from "../types/chat";

interface MessageListProps {
  messages: ChatMessage[];
  selfUserId: string | null;
}

export const MessageList = ({ messages, selfUserId }: MessageListProps) => {
  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto rounded-xl border border-cosmos-700/50 bg-cosmos-900/50 p-3">
      {messages.length === 0 ? (
        <p className="text-sm text-slate-400">No messages yet. Say hello when nearby.</p>
      ) : null}

      {messages.map((message) => {
        const isOwnMessage = message.fromUserId === selfUserId;

        return (
          <div
            key={message.id}
            className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
              isOwnMessage
                ? "ml-auto bg-cosmos-500/30 text-cosmos-300"
                : "bg-slate-800/70 text-slate-200"
            }`}
          >
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              {message.fromUserId}
            </p>
            <p className="whitespace-pre-wrap break-words">{message.message}</p>
          </div>
        );
      })}
    </div>
  );
};
