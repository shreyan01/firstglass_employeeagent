'use client'
import Image from 'next/image';
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from 'react-markdown';
import { FcGoogle } from 'react-icons/fc';
import { supabase } from './supabaseClient';
import type { User as SupabaseUser } from '@supabase/supabase-js';

// Message type
 type ChatMessage = {
   sender: string;
   text: string;
   image?: string;
 };

 type ChatSession = {
   id: string;
   title: string;
   created: number;
   messages: ChatMessage[];
   threadId?: string; // OpenAI thread ID
 };

// Backend API query function (calls internal API route, text only)
async function query(data: { question: string; threadId?: string }) {
  const response = await fetch("/api/chatbot", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  return result;
}

// Spinner component
function Spinner() {
  return (
    <span className="inline-block align-middle">
      <span className="w-5 h-5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin inline-block"></span>
    </span>
  );
}

function formatDate(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });
}

// Auth Modal Component
function AuthModal({ open, onClose, initialTab = 'signin', setUser }: { open: boolean, onClose: () => void, initialTab?: 'signin' | 'signup', setUser: (user: SupabaseUser | null) => void }) {
  const [tab, setTab] = useState<'signin' | 'signup'>(initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset tab when modal opens
  useEffect(() => {
    if (open) setTab(initialTab || 'signin');
    setError(null);
  }, [open, initialTab]);

  async function handleEmailAuth(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    if (tab === 'signin') {
      const { error, data } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else {
        setUser(data.user);
        onClose();
      }
    } else {
      const name = (form.elements.namedItem('name') as HTMLInputElement).value;
      const { error, data } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
      if (error) setError(error.message);
      else {
        setUser(data.user);
        onClose();
      }
    }
    setLoading(false);
  }

  async function handleGoogleAuth() {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) setError(error.message);
    setLoading(false);
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative animate-fadeIn">
        <button
          className="absolute top-4 right-4 text-blue-400 hover:text-blue-700 text-2xl font-bold"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        <div className="flex mb-8">
          <button
            className={`flex-1 py-2 rounded-l-xl font-semibold transition ${tab === 'signin' ? 'bg-blue-700 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
            onClick={() => setTab('signin')}
          >
            Sign In
          </button>
          <button
            className={`flex-1 py-2 rounded-r-xl font-semibold transition ${tab === 'signup' ? 'bg-blue-700 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
            onClick={() => setTab('signup')}
          >
            Sign Up
          </button>
        </div>
        {error && <div className="mb-4 text-red-500 text-sm text-center">{error}</div>}
        {tab === 'signin' ? (
          <>
            <button
              type="button"
              className="flex items-center justify-center gap-2 w-full py-3 mb-4 rounded-full border border-blue-200 bg-white hover:bg-blue-50 text-blue-900 font-semibold shadow-sm transition"
              onClick={handleGoogleAuth}
              disabled={loading}
            >
              <FcGoogle className="w-5 h-5" /> Sign in with Google
            </button>
            <form className="flex flex-col gap-4" onSubmit={handleEmailAuth}>
              <input name="email" type="email" placeholder="Email" className="px-4 py-3 rounded-full border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-blue-50 text-blue-900" />
              <input name="password" type="password" placeholder="Password" className="px-4 py-3 rounded-full border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-blue-50 text-blue-900" />
              <button type="submit" className="mt-2 px-6 py-3 rounded-full bg-blue-700 text-white font-semibold hover:bg-blue-800 transition" disabled={loading}>Sign In</button>
              <div className="text-xs text-blue-400 text-center mt-2">Don&apos;t have an account? <button type="button" className="text-blue-700 underline" onClick={() => setTab('signup')}>Sign Up</button></div>
            </form>
          </>
        ) : (
          <>
            <button
              type="button"
              className="flex items-center justify-center gap-2 w-full py-3 mb-4 rounded-full border border-blue-200 bg-white hover:bg-blue-50 text-blue-900 font-semibold shadow-sm transition"
              onClick={handleGoogleAuth}
              disabled={loading}
            >
              <FcGoogle className="w-5 h-5" /> Sign up with Google
            </button>
            <form className="flex flex-col gap-4" onSubmit={handleEmailAuth}>
              <input name="name" type="text" placeholder="Full Name" className="px-4 py-3 rounded-full border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-blue-50 text-blue-900" />
              <input name="email" type="email" placeholder="Email" className="px-4 py-3 rounded-full border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-blue-50 text-blue-900" />
              <input name="password" type="password" placeholder="Password" className="px-4 py-3 rounded-full border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-blue-50 text-blue-900" />
              <button type="submit" className="mt-2 px-6 py-3 rounded-full bg-blue-700 text-white font-semibold hover:bg-blue-800 transition" disabled={loading}>Sign Up</button>
              <div className="text-xs text-blue-400 text-center mt-2">Already have an account? <button type="button" className="text-blue-700 underline" onClick={() => setTab('signin')}>Sign In</button></div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  // Chat state
  const [chats, setChats] = useState<ChatSession[]>(() => [
    {
      id: Date.now().toString(),
      title: 'New Chat',
      created: Date.now(),
      messages: [
        { sender: "bot", text: "Hi! How can I help you today?" },
      ],
    },
  ]);
  const [activeChatId, setActiveChatId] = useState(chats[0].id);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [authModalOpen, setAuthModalOpen] = useState<false | 'signin' | 'signup'>(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);

  // Get active chat
  const activeChat = chats.find((c) => c.id === activeChatId)!;

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeChat.messages, loading]);

  // Handle sending a message
  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      setAuthModalOpen('signin');
      return;
    }
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { sender: "user", text: input };
    // Add user message
    setChats((prev) => prev.map(chat =>
      chat.id === activeChatId
        ? { ...chat, messages: [...chat.messages, userMsg] }
        : chat
    ));
    setInput("");
    setLoading(true);
    // Add loading indicator
    setChats((prev) => prev.map(chat =>
      chat.id === activeChatId
        ? { ...chat, messages: [...chat.messages, { sender: "bot", text: "__spinner__" }] }
        : chat
    ));
    try {
      const response = await query({ question: userMsg.text, threadId: activeChat.threadId });
      setChats((prev) => prev.map(chat =>
        chat.id === activeChatId
          ? {
              ...chat,
              threadId: response.threadId, // Store the thread ID
              messages: [
                ...chat.messages.slice(0, -1),
                { sender: "bot", text: response.text || "Sorry, I didn't understand that." },
              ],
            }
          : chat
      ));
    } catch (err) {
      setChats((prev) => prev.map(chat =>
        chat.id === activeChatId
          ? {
              ...chat,
              messages: [
                ...chat.messages.slice(0, -1),
                { sender: "bot", text: "Sorry, there was an error. Please try again." + err },
              ],
            }
          : chat
      ));
    } finally {
      setLoading(false);
    }
  }

  // Handle image upload (local preview only)
  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!user) {
      setAuthModalOpen('signin');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setChats((prev) => prev.map(chat =>
        chat.id === activeChatId
          ? {
              ...chat,
              messages: [
                ...chat.messages,
                { sender: "user", text: "", image: event.target?.result as string },
              ],
            }
          : chat
      ));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  // New chat
  function handleNewChat() {
    const newId = Date.now().toString();
    const newChat: ChatSession = {
      id: newId,
      title: 'New Chat',
      created: Date.now(),
      messages: [
        { sender: "bot", text: "Hi! How can I help you today?" },
      ],
    };
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newId);
    setSidebarOpen(false);
  }

  // Sidebar width
  const sidebarWidth = 270;

  // Track Supabase auth session
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    return () => { listener?.subscription.unsubscribe(); };
  }, []);

  return (
    <div className="min-h-screen flex bg-[#f6fafd] font-sans">
      {/* Sidebar */}
      <aside
        className={`bg-white border-r border-blue-100 h-screen flex flex-col transition-all duration-300 z-30 ${sidebarOpen ? 'fixed left-0 top-0 w-[80vw] max-w-xs' : 'w-0 md:w-[270px]'} ${sidebarOpen ? 'shadow-2xl' : ''} rounded-r-2xl md:rounded-r-3xl`}
        style={{ minWidth: sidebarOpen ? sidebarWidth : undefined }}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-blue-100">
          <span className="font-bold text-blue-900 text-lg">Chats</span>
          <button
            className="bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full p-2 ml-2"
            onClick={handleNewChat}
            title="New Chat"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            className="md:hidden ml-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full p-2"
            onClick={() => setSidebarOpen(false)}
            title="Close sidebar"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {chats.map((chat) => (
            <button
              key={chat.id}
              className={`w-full text-left px-4 py-3 border-b border-blue-50 hover:bg-blue-50 transition flex flex-col ${chat.id === activeChatId ? 'bg-blue-100' : ''} rounded-xl mb-2`}
              onClick={() => { setActiveChatId(chat.id); setSidebarOpen(false); }}
            >
              <span className="font-medium text-blue-900 truncate">{chat.title}</span>
              <span className="text-xs text-blue-400">{formatDate(chat.created)}</span>
            </button>
          ))}
        </div>
        <div className="p-4 border-t border-blue-100 text-xs text-blue-400">© {new Date().getFullYear()} First Glass of Arkansas</div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-screen relative">
        {/* Auth Modal */}
        <AuthModal open={!!authModalOpen} onClose={() => setAuthModalOpen(false)} initialTab={authModalOpen === 'signup' ? 'signup' : 'signin'} setUser={setUser} />
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-4 border-b border-blue-100 bg-white shadow-sm rounded-b-2xl">
          <div className="flex items-center gap-3">
            <button className="md:hidden bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full p-2" onClick={() => setSidebarOpen(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Image src="/logo.png" alt="First Glass of Arkansas" width={30} height={30} />
            <span className="text-xl font-bold text-blue-900 tracking-tight">First Glass of Arkansas</span>
          </div>
          <div className="flex gap-3">
            {user ? (
              <button className="px-5 py-2 rounded-full bg-blue-100 text-blue-700 border border-blue-200 font-semibold hover:bg-blue-200 transition" onClick={async () => { await supabase.auth.signOut(); setUser(null); }}>Sign Out</button>
            ) : (
              <>
                <button className="px-5 py-2 rounded-full bg-white text-blue-700 border border-blue-200 font-semibold hover:bg-blue-50 transition" onClick={() => setAuthModalOpen('signup')}>Sign Up</button>
                <button className="px-5 py-2 rounded-full bg-blue-700 text-white font-semibold hover:bg-blue-800 transition" onClick={() => setAuthModalOpen('signin')}>Sign In</button>
              </>
            )}
          </div>
        </header>

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto bg-[#f6fafd] px-0 sm:px-0 py-6">
          <div className="max-w-2xl mx-auto flex flex-col gap-4">
            {activeChat.messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={
                    msg.sender === 'user'
                      ? 'bg-blue-700 text-white rounded-xl px-6 py-3 max-w-[80%] whitespace-pre-wrap shadow-md'
                      : 'bg-white text-blue-900 rounded-xl px-6 py-3 max-w-[80%] prose prose-blue prose-sm shadow-md'
                  }
                >
                  {msg.image ? (
                    <Image src={msg.image} alt="Uploaded" className="rounded-lg max-w-xs max-h-60" width={300} height={200} />
                  ) : msg.text === "__spinner__"
                    ? <Spinner />
                    : msg.sender === "bot"
                      ? <ReactMarkdown>{msg.text}</ReactMarkdown>
                      : msg.text}
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Input area (fixed at bottom) */}
        <form
          className="w-full max-w-2xl mx-auto flex gap-2 items-center px-4 py-4 bg-white border-t border-blue-100 sticky bottom-0 z-10"
          onSubmit={handleSend}
          autoComplete="off"
        >
          {/* Image upload button */}
          <label className="cursor-pointer bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full p-2 flex items-center" title="Upload image">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
              disabled={loading}
            />
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V19a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2.5M7 10l5 5 5-5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15V3" />
            </svg>
          </label>
          <input
            type="text"
            placeholder="Type your message..."
            className="flex-1 px-4 py-3 rounded-full border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white text-blue-900 shadow-sm"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
            disabled={loading}
            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter' && !e.shiftKey && !loading) handleSend(e as unknown as React.FormEvent); }}
          />
          <button
            type="submit"
            className="px-6 py-3 rounded-full bg-blue-700 text-white font-semibold hover:bg-blue-800 transition disabled:opacity-60 shadow-md"
            disabled={!input.trim() || loading}
          >
            {loading ? <Spinner /> : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}
