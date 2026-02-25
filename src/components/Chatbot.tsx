
import { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { MessageCircle, HelpCircle, Send, X } from "lucide-react";
import { apiFetch } from "@/lib/api";

type Message = {
  sender: "user" | "bot";
  text: string;
};

const Chatbot = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "bot",
      text: "Hi there! 👋 I'm ResQBot. I can help with services, pricing, tracking, or subscriptions. How can I assist you?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, loading]);

  // Session ID Management
  useEffect(() => {
    let sessionId = sessionStorage.getItem("chatSessionId");
    if (!sessionId) {
      sessionId = Math.random().toString(36).substring(7);
      sessionStorage.setItem("chatSessionId", sessionId);
    }
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg = input.trim();
    const newMessages: Message[] = [...messages, { sender: "user", text: userMsg }];

    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const sessionId = sessionStorage.getItem("chatSessionId");

      const response = await apiFetch("/api/chatbot/message", {
        method: "POST",
        body: JSON.stringify({ sessionId, message: userMsg }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error || "Failed to get response");

      setMessages((prev) => [...prev, { sender: "bot", text: data.text }]);

    } catch (error) {
      console.error("Chat Error:", error);
      setMessages((prev) => [
        ...prev,
        { sender: "bot", text: "Sorry, I'm having trouble connecting to the server. Please try again later." }
      ]);
    } finally {
      setLoading(false);
      // Keep focus on input for better UX
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          className="fixed bottom-6 right-6 z-50 bg-red-600 hover:bg-red-700 text-white p-4 rounded-full shadow-lg flex items-center transition-all hover:scale-105 active:scale-95"
          aria-label="Open Chatbot"
          onClick={() => setOpen(true)}
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-80 sm:w-96 max-w-[90vw] bg-card dark:bg-slate-900 rounded-xl shadow-2xl border border-gray-200 flex flex-col animate-fade-in-scale origin-bottom-right overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-red-600 text-white">
            <span className="flex items-center gap-2 font-bold text-sm">
              <HelpCircle className="h-5 w-5" /> ResQNow Assistant
            </span>
            <button
              className="text-white/80 hover:text-white hover:bg-red-700 rounded-full p-1 transition-colors"
              onClick={() => setOpen(false)}
              aria-label="Close Chatbot"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages Area */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-gray-50/50"
            style={{ minHeight: 300, maxHeight: 400 }}
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`rounded-2xl px-4 py-3 max-w-[85%] text-sm shadow-sm whitespace-pre-wrap ${m.sender === "user"
                      ? "bg-red-600 text-white rounded-br-none"
                      : "bg-card dark:bg-slate-900 text-gray-800 border border-gray-100 rounded-bl-none"
                    }`}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start animate-fade-in">
                <div className="bg-card dark:bg-slate-900 border border-gray-100 text-gray-400 rounded-2xl rounded-bl-none px-4 py-3 text-sm shadow-sm flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <form
            className="flex gap-2 p-3 bg-card dark:bg-slate-900 border-t border-gray-100"
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
          >
            <Input
              ref={inputRef}
              type="text"
              placeholder="Ask for help..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              autoFocus
              className="flex-1 border-gray-200 focus-visible:ring-red-500 rounded-full px-4"
            />
            <Button
              type="submit"
              className="bg-red-600 hover:bg-red-700 rounded-full w-10 h-10 p-0 flex items-center justify-center shrink-0"
              disabled={loading || !input.trim()}
            >
              <Send className="h-4 w-4 ml-0.5" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
};

export default Chatbot;
