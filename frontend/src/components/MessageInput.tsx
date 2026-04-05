import { FormEvent, useState } from "react";

interface MessageInputProps {
  disabled?: boolean;
  onSend: (text: string) => void;
}

export const MessageInput = ({ disabled, onSend }: MessageInputProps) => {
  const [text, setText] = useState("");

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = text.trim();

    if (!next || disabled) {
      return;
    }

    onSend(next);
    setText("");
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
      <input
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={disabled ? "Move closer to chat" : "Type a message"}
        disabled={disabled}
        className="flex-1 rounded-lg border border-cosmos-700/70 bg-cosmos-900/70 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-cosmos-300 disabled:cursor-not-allowed disabled:opacity-60"
        maxLength={500}
      />
      <button
        type="submit"
        disabled={disabled || text.trim().length === 0}
        className="rounded-lg bg-cosmos-500 px-3 py-2 text-sm font-semibold text-cosmos-900 transition hover:bg-cosmos-300 disabled:cursor-not-allowed disabled:opacity-60"
      >
        Send
      </button>
    </form>
  );
};
