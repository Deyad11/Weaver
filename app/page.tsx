"use client";

import { useState } from "react";

type Message = {
  role: "user" | "character";
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput("");

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: userMessage },
    ];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          characterId: "young_man",
          history: messages.map((m) => ({
            role: m.role === "user" ? "user" : "character",
            content: m.content,
          })),
        }),
      });

      const data = await res.json();

      setMessages([
        ...newMessages,
        { role: "character", content: data.response },
      ]);
    } catch {
      setMessages([...newMessages, { role: "character", content: "..." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-50 flex flex-col items-center justify-start py-16 px-4">
      <div className="w-full max-w-xl flex flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-sm font-medium text-neutral-400 tracking-widest uppercase">
            Weaver
          </h1>
          <p className="text-lg text-neutral-800 font-light">The young man</p>
        </div>

        {/* Conversation */}
        <div className="flex flex-col gap-6 min-h-[400px]">
          {messages.length === 0 && (
            <p className="text-neutral-300 text-sm italic">Say something.</p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex flex-col gap-1 ${
                msg.role === "user" ? "items-end" : "items-start"
              }`}
            >
              <p className="text-xs text-neutral-300 uppercase tracking-widest">
                {msg.role === "user" ? "You" : "Him"}
              </p>
              <p
                className={`text-neutral-800 text-sm leading-relaxed max-w-sm ${
                  msg.role === "user" ? "text-right" : "text-left"
                }`}
              >
                {msg.content}
              </p>
            </div>
          ))}
          {loading && (
            <div className="flex flex-col gap-1 items-start">
              <p className="text-xs text-neutral-300 uppercase tracking-widest">
                Him
              </p>
              <p className="text-neutral-300 text-sm">...</p>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-neutral-200 pt-6">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Say something..."
            className="w-full bg-transparent text-neutral-800 text-sm placeholder-neutral-300 outline-none"
          />
        </div>
      </div>
    </main>
  );
}
