'use client'
import { useState, useRef, useEffect } from "react";
import ReactMarkdown from 'react-markdown';
import Image from 'next/image';
import { FcGoogle } from 'react-icons/fc';
import { supabase } from './supabaseClient';
import type { User as SupabaseUser } from '@supabase/supabase-js';

// Message type
 type ChatMessage = {
   sender: string;
   text: string;
   image?: string;
   id?: string; // Added for typing animation
 };

// Simplified chat storage using OpenAI threads
type ChatSession = {
  id: string;
  title: string;
  created: number;
  threadId?: string; // OpenAI thread ID - this is our primary storage
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl w-full max-w-md p-6 md:p-8 relative animate-fadeIn border border-blue-100/50">
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

// Typing dots animation component
function TypingDots() {
  return (
    <div className="flex space-x-1">
      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
    </div>
  );
}

// Typewriter text component
function TypewriterText({ text, onComplete }: { text: string; onComplete?: () => void }) {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, 15); // Speed of typing (faster)

      return () => clearTimeout(timer);
    } else if (onComplete) {
      onComplete();
    }
  }, [currentIndex, text, onComplete]);

  return <span>{displayedText}</span>;
}

// Citation component
function CitationButton({ citation }: { citation: string }) {
  return (
    <span className="inline-block relative group">
      <button className="inline-flex items-center justify-center w-5 h-5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold hover:bg-blue-200 transition-all duration-200 group-hover:scale-110">
        📄
      </button>
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
        {citation}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
      </div>
    </span>
  );
}

// Function to process text and extract citations with markdown
function processTextWithCitations(text: string) {
  // Split text by citation pattern
  const parts = text.split(/(【[^】]+】)/);
  
  return parts.map((part, index) => {
    if (part.match(/^【[^】]+】$/)) {
      // This is a citation
      const citation = part.slice(1, -1); // Remove 【】
      return <CitationButton key={index} citation={citation} />;
    } else {
      // This is regular text - render with markdown
      return (
        <span key={index} className="inline">
          <ReactMarkdown>
            {part}
          </ReactMarkdown>
        </span>
      );
    }
  });
}

// Auto-title generation function
async function generateChatTitle(firstMessage: string): Promise<string> {
  try {
    // Clean the message
    let cleanedMessage = firstMessage.trim();
    
    // Strip common greetings
    const greetings = [
      'hey', 'hello', 'hi', 'good morning', 'good afternoon', 'good evening',
      'greetings', 'howdy', 'yo', 'what\'s up', 'sup', 'good day'
    ];
    
    for (const greeting of greetings) {
      const regex = new RegExp(`^${greeting}[!?.,]*\\s*`, 'i');
      cleanedMessage = cleanedMessage.replace(regex, '');
    }
    
    // Remove filler words
    const fillerWords = [
      'um', 'uh', 'like', 'you know', 'basically', 'actually', 'literally',
      'kind of', 'sort of', 'i think', 'i guess', 'maybe', 'probably'
    ];
    
    for (const filler of fillerWords) {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      cleanedMessage = cleanedMessage.replace(regex, '');
    }
    
    // Clean up extra spaces
    cleanedMessage = cleanedMessage.replace(/\s+/g, ' ').trim();
    
    // If message is empty after cleaning, return default
    if (!cleanedMessage) {
      return 'New Chat';
    }
    
    // Use first sentence (up to 50 characters)
    let title = cleanedMessage.split(/[.!?]/)[0].trim();
    
    // If still too long, truncate to 30 characters
    if (title.length > 30) {
      title = title.substring(0, 30) + '...';
    }
    
    return title || 'New Chat';
  } catch (error) {
    console.error('Error generating title:', error);
    return 'New Chat';
  }
}

// Database functions for user-thread mapping
async function saveChatToDatabase(chat: ChatSession, userId: string) {
  try {
    console.log('Saving chat metadata to Supabase:', {
      chatId: chat.id,
      userId: userId,
      title: chat.title,
      threadId: chat.threadId
    });
    
    // Save or update chat session in Supabase
    const { error: chatError } = await supabase
      .from('chats')
      .upsert({
        id: chat.id,
        user_id: userId,
        title: chat.title,
        created_at: new Date(chat.created).toISOString(),
        updated_at: new Date().toISOString(),
        thread_id: chat.threadId
      });

    if (chatError) throw chatError;
    console.log('Chat metadata saved successfully to Supabase');
  } catch (error) {
    console.error('Error saving chat metadata to Supabase:', error);
    throw error;
  }
}

async function loadUserChats(userId: string): Promise<ChatSession[]> {
  try {
    console.log('Loading chats for user from Supabase:', userId);
    
    // Load chat sessions from Supabase
    const { data: chatsData, error: chatsError } = await supabase
      .from('chats')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (chatsError) throw chatsError;

    console.log('Found chats in Supabase:', chatsData);

    if (!chatsData || chatsData.length === 0) {
      console.log('No chats found, creating default chat');
      const defaultChat: ChatSession = {
        id: Date.now().toString(),
        title: 'New Chat',
        created: Date.now(),
      };
      return [defaultChat];
    }

    // Convert Supabase data to ChatSession format
    const chats: ChatSession[] = chatsData.map(chatData => ({
      id: chatData.id,
      title: chatData.title,
      created: new Date(chatData.created_at).getTime(),
      threadId: chatData.thread_id
    }));

    console.log('Returning chats from Supabase:', chats);
    return chats;
  } catch (error) {
    console.error('Error loading chats from Supabase:', error);
    return [{
      id: Date.now().toString(),
      title: 'New Chat',
      created: Date.now(),
    }];
  }
}

// Load messages from OpenAI thread
async function loadMessagesFromThread(threadId: string): Promise<ChatMessage[]> {
  try {
    console.log('Loading messages from OpenAI thread:', threadId);
    
    const response = await fetch('/api/chatbot/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ threadId }),
    });

    if (!response.ok) {
      throw new Error('Failed to load messages from thread');
    }

    const data = await response.json();
    console.log('Loaded messages from thread:', data.messages);
    return data.messages;
  } catch (error) {
    console.error('Error loading messages from thread:', error);
    return [{ sender: "bot", text: "Hi! How can I help you today?" }];
  }
}

export default function Home() {
  // Chat state
  const [chats, setChats] = useState<ChatSession[]>(() => [
    {
      id: Date.now().toString(),
      title: 'New Chat',
      created: Date.now(),
    },
  ]);
  const [activeChatId, setActiveChatId] = useState(chats[0].id);
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[]>([
    { sender: "bot", text: "Hi! How can I help you today?" }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [authModalOpen, setAuthModalOpen] = useState<false | 'signin' | 'signup'>(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [typingMessages, setTypingMessages] = useState<Set<string>>(new Set());


  // Get active chat
  const activeChat = chats.find((c) => c.id === activeChatId)!;

  // Load messages when switching chats
  useEffect(() => {
    if (activeChat?.threadId) {
      loadMessagesFromThread(activeChat.threadId).then(messages => {
        setCurrentMessages(messages);
      });
    } else {
      setCurrentMessages([{ sender: "bot", text: "Hi! How can I help you today?" }]);
    }
  }, [activeChatId, activeChat?.threadId]);

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages, loading]);

  // Handle sending a message
  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    // Reactivate auth
    if (!user) {
      setAuthModalOpen('signin');
      return;
    }
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { sender: "user", text: input };
    
    // Check if this is the first user message (auto-title)
    const isFirstUserMessage = currentMessages.filter(msg => msg.sender === 'user').length === 0;
    
    // Add user message
    setCurrentMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    
    // Generate title if this is the first user message
    let newTitle = '';
    if (isFirstUserMessage) {
      newTitle = await generateChatTitle(input);
      setChats((prev) => prev.map(chat =>
        chat.id === activeChatId
          ? { ...chat, title: newTitle }
          : chat
      ));
    }
    
    // Add loading indicator with typing animation
    const loadingMessageId = `${activeChatId}-${Date.now()}`;
    setTypingMessages(prev => new Set(prev).add(loadingMessageId));
    setCurrentMessages(prev => [...prev, { sender: "bot", text: "", id: loadingMessageId }]);
    
    try {
      const response = await query({ question: userMsg.text, threadId: activeChat.threadId });
      
      // Update chat with thread ID if this is the first message
      if (!activeChat.threadId) {
        const updatedChat = { 
          ...activeChat, 
          threadId: response.threadId,
          title: newTitle || activeChat.title
        };
        setChats((prev) => prev.map(chat =>
          chat.id === activeChatId
            ? updatedChat
            : chat
        ));
        
        // Save the updated chat with threadId to Supabase
        if (user) {
          try {
            await saveChatToDatabase(updatedChat, user.id);
          } catch (error) {
            console.error('Error saving chat with threadId:', error);
          }
        }
      }
      
      // Replace loading message with actual response
      setCurrentMessages(prev => [
        ...prev.slice(0, -1),
        { sender: "bot", text: response.text || "Sorry, I didn't understand that.", id: loadingMessageId }
      ]);
      
      // Start typing animation
      setTypingMessages(prev => {
        const newSet = new Set(prev);
        newSet.delete(loadingMessageId);
        return newSet;
      });
      
    } catch (err) {
      setCurrentMessages(prev => [
        ...prev.slice(0, -1),
        { sender: "bot", text: "Sorry, there was an error. Please try again." + err, id: loadingMessageId }
      ]);
      setTypingMessages(prev => {
        const newSet = new Set(prev);
        newSet.delete(loadingMessageId);
        return newSet;
      });
    } finally {
      setLoading(false);
    }
  }

  // Handle image upload (local preview only)
  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    // Temporarily disabled auth
    // if (!user) {
    //   setAuthModalOpen('signin');
    //   return;
    // }
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCurrentMessages(prev => [...prev, { sender: "user", text: "", image: event.target?.result as string }]);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  // New chat
  async function handleNewChat() {
    const newId = Date.now().toString();
    const newChat: ChatSession = {
      id: newId,
      title: 'New Chat',
      created: Date.now(),
    };
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newId);
    setSidebarOpen(false);
    
    // Save new chat to Supabase if user is logged in
    if (user) {
      try {
        await saveChatToDatabase(newChat, user.id);
      } catch (error) {
        console.error('Error saving new chat:', error);
      }
    }
  }

  // Load user chats when user logs in
  useEffect(() => {
    if (user) {
      console.log('Loading chats for user:', user.id);
      loadUserChats(user.id).then(loadedChats => {
        console.log('Loaded chats:', loadedChats);
        setChats(loadedChats);
        if (loadedChats.length > 0) {
          setActiveChatId(loadedChats[0].id);
        }
      }).catch(error => {
        console.error('Error loading chats:', error);
      });
    }
  }, [user]);

  // Save chat when threadId or title changes
  useEffect(() => {
    if (user && activeChat && activeChat.threadId) {
      console.log('Saving chat to database:', activeChat.id, 'for user:', user.id);
      saveChatToDatabase(activeChat, user.id).catch(error => {
        console.error('Error saving chat:', error);
      });
    }
  }, [activeChat, user]);



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
    <div className="min-h-screen flex bg-gradient-to-br from-blue-50 via-white to-indigo-50 font-sans">
      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`bg-white/95 backdrop-blur-sm border-r border-blue-100/50 h-screen flex flex-col transition-all duration-300 z-40 ${
          sidebarOpen 
            ? 'fixed left-0 top-0 w-[85vw] max-w-[320px] shadow-2xl' 
            : 'w-0 md:w-[280px]'
        } ${sidebarOpen ? 'shadow-2xl' : ''} rounded-r-3xl md:rounded-r-3xl`}
        style={{ minWidth: sidebarOpen ? 320 : undefined }}
      >
        <div className="flex items-center justify-between px-4 py-4 border-b border-blue-100/50">
          <span className="font-bold text-blue-900 text-lg">Chats</span>
          <div className="flex items-center gap-2">
            <button
              className="bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full p-2 transition-colors duration-200"
              onClick={handleNewChat}
              title="New Chat"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              className="md:hidden bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full p-2 transition-colors duration-200"
              onClick={() => setSidebarOpen(false)}
              title="Close sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {chats.map((chat) => (
            <button
              key={chat.id}
              className={`w-full text-left px-3 py-3 border border-transparent hover:border-blue-200 hover:bg-blue-50/50 transition-all duration-200 flex flex-col rounded-xl mb-2 ${
                chat.id === activeChatId ? 'bg-blue-100/70 border-blue-200 shadow-sm' : ''
              }`}
              onClick={() => { setActiveChatId(chat.id); setSidebarOpen(false); }}
            >
              <span className="font-medium text-blue-900 truncate text-sm">{chat.title}</span>
              <span className="text-xs text-blue-400 mt-1">{formatDate(chat.created)}</span>
            </button>
          ))}
        </div>
        <div className="hidden lg:block p-4 border-t border-blue-100/50 text-xs text-blue-400">
          {new Date().getFullYear()} First Glass of Arkansas
          <br />
          Powered by <a href="https://longspan.ai" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline hover:text-blue-800 transition-colors"><b>Longspan</b></a>
        </div>
      </aside>

              {/* Main Chat Area */}
        <main className="flex-1 flex flex-col h-screen min-h-0 relative">
          {/* Header */}
          <header className="bg-white/80 backdrop-blur-sm border-b border-blue-100/50 px-4 py-3 flex items-center justify-between flex-shrink-0 z-50">
          <div className="flex items-center gap-3">
            <button
              className="md:hidden bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full p-2 transition-colors duration-200"
              onClick={() => setSidebarOpen(true)}
              title="Open sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-semibold text-blue-900">First Glass Assistant</h1>
              <p className="text-xs text-blue-500">Your AI-powered workplace companion</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user ? (
              <div className="flex items-center gap-2">
                <div className="hidden sm:block text-sm text-blue-600">
                  {user.email}
                </div>
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="bg-red-100 hover:bg-red-200 text-red-700 rounded-full px-3 py-1 text-sm transition-colors duration-200"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => setAuthModalOpen('signin')}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200"
              >
                Sign In
              </button>
            )}
          </div>
        </header>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-blue-50/30 to-white px-4 py-6 min-h-0 pb-4">
          <div className="max-w-4xl mx-auto flex flex-col gap-4">
            {currentMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3 shadow-sm ${
                    msg.sender === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-white border border-blue-100 text-gray-800"
                  }`}
                >
                  {msg.image && (
                    <Image
                      src={msg.image}
                      alt="Uploaded"
                      className="max-w-full h-auto rounded-lg mb-2"
                    />
                  )}
                  <div className="whitespace-pre-wrap">
                    {msg.sender === "bot" ? (
                      <div className="prose prose-sm max-w-none">
                        {typingMessages.has(msg.id || "") ? (
                          <div className="prose prose-sm max-w-none">
                            <TypewriterText
                              text={msg.text}
                              onComplete={() => {
                                setTypingMessages(prev => {
                                  const newSet = new Set(prev);
                                  newSet.delete(msg.id || "");
                                  return newSet;
                                });
                              }}
                            />
                          </div>
                        ) : (
                          <div className="prose prose-sm max-w-none">
                            {processTextWithCitations(msg.text)}
                          </div>
                        )}
                      </div>
                    ) : (
                      msg.text
                    )}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-blue-100 text-gray-800 rounded-2xl px-4 py-3 shadow-sm">
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="bg-white/80 backdrop-blur-sm border-t border-blue-100/50 p-4 flex-shrink-0 z-20">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSend} className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={user ? "Type your message..." : "Sign in to start chatting..."}
                  className="w-full px-4 py-3 border border-blue-200 text-black rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 bg-white/90 backdrop-blur-sm"
                  disabled={!user || loading}
                />
                <label className="absolute right-3 top-1/2 transform -translate-y-1/2 cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={!user || loading}
                  />
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                    className="w-5 h-5 text-blue-400 hover:text-blue-600 transition-colors duration-200"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"
                    />
                  </svg>
                </label>
              </div>
              <button
                type="submit"
                disabled={!input.trim() || loading || !user}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-2xl px-6 py-3 font-medium transition-all duration-200 shadow-sm hover:shadow-md disabled:shadow-none"
              >
                {loading ? <Spinner /> : "Send"}
              </button>
            </form>
          </div>
        </div>
      </main>

      {/* Auth Modal */}
      <AuthModal
        open={authModalOpen !== false}
        onClose={() => setAuthModalOpen(false)}
        initialTab={authModalOpen === 'signup' ? 'signup' : 'signin'}
        setUser={setUser}
      />
    </div>
  );
}
