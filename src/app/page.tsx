'use client'
import { useState, useRef, useEffect } from "react";

export default function Home() {
  // Chatbot state
  const [messages, setMessages] = useState([
    { sender: "bot", text: "Hi! How can I help you today?" },
  ]);
  const [input, setInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle sending a message
  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg = { sender: "user", text: input };
    setMessages((msgs) => [...msgs, userMsg]);
    setInput("");
    // Simulate bot reply
    setTimeout(() => {
      setMessages((msgs) => [
        ...msgs,
        {
          sender: "bot",
          text: "Thanks for your message! (This is a demo bot.)",
        },
      ]);
    }, 700);
  }

  return (
    <div className="min-h-screen bg-[#f6fafd] font-sans flex flex-col">
      {/* Header */}
      <header className="w-full flex items-center justify-between px-8 py-6 bg-transparent">
        <div className="flex items-center gap-3">
          {/* Placeholder logo */}
          <div className="w-10 h-10 bg-blue-200 rounded-full flex items-center justify-center">
            <span className="text-2xl font-bold text-blue-700">F</span>
          </div>
          <span className="text-xl font-bold text-blue-900 tracking-tight">First Glass of Arkansas</span>
        </div>
        <nav className="hidden md:flex gap-8 text-blue-900 font-medium text-base">
          <a href="#" className="hover:text-blue-600 transition">Home</a>
          <a href="#" className="hover:text-blue-600 transition">How it works</a>
          <a href="#" className="hover:text-blue-600 transition">Resources</a>
          <a href="#" className="hover:text-blue-600 transition">FAQ</a>
        </nav>
        <div className="flex gap-3">
          <button className="px-5 py-2 rounded-full bg-white text-blue-700 border border-blue-200 font-semibold hover:bg-blue-50 transition">Sign Up</button>
          <button className="px-5 py-2 rounded-full bg-blue-700 text-white font-semibold hover:bg-blue-800 transition">Sign In</button>
        </div>
      </header>

      {/* Main Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 pb-12">
        <div className="w-full max-w-4xl bg-white rounded-3xl shadow-md py-14 px-6 sm:px-16 flex flex-col items-center relative">
          {/* Headline */}
          <div className="flex flex-col items-center mb-8">
            <span className="inline-block bg-blue-100 text-blue-700 text-xs font-semibold rounded-full px-4 py-1 mb-4">Internal Employee Chatbot</span>
            <h1 className="text-4xl sm:text-5xl font-bold text-blue-900 text-center mb-4 leading-tight">Connect, Ask, and Get Support Instantly</h1>
            <p className="text-lg text-blue-800 text-center max-w-2xl">Your internal assistant for all things First Glass of Arkansas. Get answers, HR help, IT support, and more—right at your fingertips.</p>
          </div>

          {/* Chatbot UI */}
          <div className="w-full max-w-xl bg-[#f6fafd] rounded-2xl border border-blue-100 shadow-inner p-6 flex flex-col gap-4 min-h-[340px] mb-8">
            {/* Chat bubbles */}
            <div className="flex-1 flex flex-col gap-2 overflow-y-auto max-h-64 scrollbar-thin pr-1">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={
                    msg.sender === "user"
                      ? "self-end bg-blue-700 text-white rounded-xl px-4 py-2 max-w-[80%]"
                      : "self-start bg-blue-100 text-blue-900 rounded-xl px-4 py-2 max-w-[80%]"
                  }
                >
                  {msg.text}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            {/* Input area */}
            <form className="flex gap-2 mt-4" onSubmit={handleSend} autoComplete="off">
              <input
                type="text"
                placeholder="Type your message..."
                className="flex-1 px-4 py-2 rounded-full border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white text-blue-900"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                autoFocus
              />
              <button
                type="submit"
                className="px-6 py-2 rounded-full bg-blue-700 text-white font-semibold hover:bg-blue-800 transition disabled:opacity-60"
                disabled={!input.trim()}
              >
                Send
              </button>
            </form>
          </div>

          {/* Employee Testimonials */}
          <div className="w-full flex flex-col sm:flex-row justify-between gap-6 mt-2">
            <div className="flex items-center gap-3 bg-blue-50 rounded-xl px-4 py-3 shadow-sm max-w-xs">
              <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center">
                <span className="text-lg font-bold text-blue-700">A</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-purple-600 mb-1">IMPROVEMENT</span>
                <span className="text-sm text-blue-900">&quot;The chatbot helped me reset my password in seconds!&quot;</span>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-blue-50 rounded-xl px-4 py-3 shadow-sm max-w-xs">
              <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center">
                <span className="text-lg font-bold text-blue-700">J</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-pink-500 mb-1">AWESOME</span>
                <span className="text-sm text-blue-900">&quot;Now I get HR answers without waiting for emails!&quot;</span>
              </div>
            </div>
          </div>
        </div>
        <div className="text-center text-blue-400 text-sm mt-8">Join 50+ happy employees</div>
      </main>

      {/* Footer */}
      <footer className="w-full flex flex-col items-center justify-center py-6 bg-transparent mt-auto">
        <div className="flex gap-6 text-blue-700 text-sm font-medium">
          <a href="#" className="hover:underline">Privacy Policy</a>
          <a href="#" className="hover:underline">Employee Handbook</a>
          <a href="#" className="hover:underline">Support</a>
        </div>
        <div className="text-blue-300 text-xs mt-2">© {new Date().getFullYear()} First Glass of Arkansas. All rights reserved.</div>
      </footer>
    </div>
  );
}
