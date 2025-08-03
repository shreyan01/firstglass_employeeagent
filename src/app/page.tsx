'use client'
import { useState, useRef, useEffect, useCallback } from "react";
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
  id?: string;
  timestamp?: number;
  isError?: boolean;
};

// Simplified chat storage using OpenAI threads
type ChatSession = {
  id: string;
  title: string;
  created: number;
  updated: number; // Track when last interacted with
  threadId?: string;
};

// Backend API query function with streaming
async function queryStream(data: { question: string; threadId?: string }, onMessage: (text: string) => void, onComplete: (threadId: string) => void, onError: (error: string) => void) {
  console.log('queryStream: Starting request with data:', data);
  const response = await fetch("/api/chatbot/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  
  console.log('queryStream: Response status:', response.status);
  console.log('queryStream: Response ok:', response.ok);
  
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  
  if (!reader) {
    throw new Error('No response body');
  }
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      const chunk = decoder.decode(value);
      console.log('queryStream: Received chunk:', chunk);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            switch (data.type) {
              case 'start':
                onComplete(data.threadId);
                break;
              case 'message':
                onMessage(data.text);
                break;
              case 'done':
                return;
              case 'error':
                onError(data.error);
                return;
            }
          } catch (e) {
            console.error('Error parsing SSE data:', e);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// Enhanced Spinner component
function Spinner() {
  return (
    <div className="flex items-center justify-center">
      <div className="relative">
        <div className="w-5 h-5 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
        <div className="absolute inset-0 w-5 h-5 border-2 border-transparent border-t-blue-400 rounded-full animate-ping"></div>
      </div>
    </div>
  );
}

function formatDate(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (days === 1) {
    return 'Yesterday';
  } else if (days < 7) {
    return d.toLocaleDateString([], { weekday: 'short' });
  } else {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
}

// Enhanced Auth Modal Component
function AuthModal({ open, onClose, initialTab = 'signin', setUser }: { open: boolean, onClose: () => void, initialTab?: 'signin' | 'signup', setUser: (user: SupabaseUser | null) => void }) {
  const [tab, setTab] = useState<'signin' | 'signup'>(initialTab);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    
    try {
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
    } catch (err) {
      setError('An unexpected error occurred: ' + err);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleAuth() {
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
      if (error) setError(error.message);
    } catch (err) {
      setError('An unexpected error occurred: ' + err);
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl w-full max-w-md p-6 md:p-8 relative animate-fadeIn border border-blue-100/50">
        <button
          className="absolute top-4 right-4 text-blue-400 hover:text-blue-700 text-2xl font-bold transition-colors"
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
        {error && <div className="mb-4 text-red-500 text-sm text-center bg-red-50 p-3 rounded-lg">{error}</div>}
        {tab === 'signin' ? (
          <>
            <button
              type="button"
              className="flex items-center justify-center gap-2 w-full py-3 mb-4 rounded-full border border-blue-200 bg-white hover:bg-blue-50 text-blue-900 font-semibold shadow-sm transition disabled:opacity-50"
              onClick={handleGoogleAuth}
              disabled={loading}
            >
              <FcGoogle className="w-5 h-5" /> Sign in with Google
            </button>
            <form className="flex flex-col gap-4" onSubmit={handleEmailAuth}>
              <input name="email" type="email" placeholder="Email" required className="px-4 py-3 rounded-full border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-blue-50 text-blue-900 transition-all" />
              <input name="password" type="password" placeholder="Password" required className="px-4 py-3 rounded-full border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-blue-50 text-blue-900 transition-all" />
              <button type="submit" className="mt-2 px-6 py-3 rounded-full bg-blue-700 text-white font-semibold hover:bg-blue-800 transition disabled:opacity-50" disabled={loading}>
                {loading ? <Spinner /> : 'Sign In'}
              </button>
              <div className="text-xs text-blue-400 text-center mt-2">Don&apos;t have an account? <button type="button" className="text-blue-700 underline hover:text-blue-800" onClick={() => setTab('signup')}>Sign Up</button></div>
            </form>
          </>
        ) : (
          <>
            <button
              type="button"
              className="flex items-center justify-center gap-2 w-full py-3 mb-4 rounded-full border border-blue-200 bg-white hover:bg-blue-50 text-blue-900 font-semibold shadow-sm transition disabled:opacity-50"
              onClick={handleGoogleAuth}
              disabled={loading}
            >
              <FcGoogle className="w-5 h-5" /> Sign up with Google
            </button>
            <form className="flex flex-col gap-4" onSubmit={handleEmailAuth}>
              <input name="name" type="text" placeholder="Full Name" required className="px-4 py-3 rounded-full border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-blue-50 text-blue-900 transition-all" />
              <input name="email" type="email" placeholder="Email" required className="px-4 py-3 rounded-full border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-blue-50 text-blue-900 transition-all" />
              <input name="password" type="password" placeholder="Password" required minLength={6} className="px-4 py-3 rounded-full border border-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-blue-50 text-blue-900 transition-all" />
              <button type="submit" className="mt-2 px-6 py-3 rounded-full bg-blue-700 text-white font-semibold hover:bg-blue-800 transition disabled:opacity-50" disabled={loading}>
                {loading ? <Spinner /> : 'Sign Up'}
              </button>
              <div className="text-xs text-blue-400 text-center mt-2">Already have an account? <button type="button" className="text-blue-700 underline hover:text-blue-800" onClick={() => setTab('signin')}>Sign In</button></div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// Enhanced Typing dots animation
function TypingDots() {
  return (
    <div className="flex items-center space-x-1">
      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
      <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
    </div>
  );
}



// Enhanced Citation component
function CitationButton({ citation }: { citation: string }) {
  return (
    <span className="inline-block relative group">
      <button className="inline-flex items-center justify-center w-5 h-5 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold hover:bg-blue-200 transition-all duration-200 group-hover:scale-110">
        📄
      </button>
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50 max-w-xs">
        {citation}
        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800"></div>
      </div>
    </span>
  );
}

// Enhanced text processing with citations and markdown
function processTextWithCitations(text: string) {
  const parts = text.split(/(【[^】]+】)/);
  
  return parts.map((part, index) => {
    if (part.match(/^【[^】]+】$/)) {
      const citation = part.slice(1, -1);
      return <CitationButton key={index} citation={citation} />;
    } else {
      return (
        <span key={index} className="inline">
          <ReactMarkdown
            components={{
              p: ({ children }) => <span className="inline">{children}</span>,
              strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
              em: ({ children }) => <em className="italic">{children}</em>,
              code: ({ children }) => <code className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono">{children}</code>,
              pre: ({ children }) => <pre className="bg-gray-100 p-2 rounded text-sm font-mono overflow-x-auto">{children}</pre>,
              ul: ({ children }) => <ul className="list-disc list-inside space-y-1">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal list-inside space-y-1">{children}</ol>,
              li: ({ children }) => <li className="text-sm">{children}</li>,
              blockquote: ({ children }) => <blockquote className="border-l-4 border-blue-200 pl-4 italic text-gray-600">{children}</blockquote>,
            }}
          >
            {part}
          </ReactMarkdown>
        </span>
      );
    }
  });
}

// Message actions component
function MessageActions({ message, onCopy, onRegenerate }: { message: ChatMessage; onCopy: () => void; onRegenerate?: () => void }) {
  return (
    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <div className="flex gap-1 bg-white/90 backdrop-blur-sm rounded-lg p-1 shadow-lg border border-gray-200">
        <button
          onClick={onCopy}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
          title="Copy message"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        </button>
        {onRegenerate && message.sender === 'bot' && (
          <button
            onClick={onRegenerate}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
            title="Regenerate response"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// Auto-title generation function
async function generateChatTitle(firstMessage: string): Promise<string> {
  try {
    let cleanedMessage = firstMessage.trim();
    
    const greetings = [
      'hey', 'hello', 'hi', 'good morning', 'good afternoon', 'good evening',
      'greetings', 'howdy', 'yo', 'what\'s up', 'sup', 'good day'
    ];
    
    for (const greeting of greetings) {
      const regex = new RegExp(`^${greeting}[!?.,]*\\s*`, 'i');
      cleanedMessage = cleanedMessage.replace(regex, '');
    }
    
    const fillerWords = [
      'um', 'uh', 'like', 'you know', 'basically', 'actually', 'literally',
      'kind of', 'sort of', 'i think', 'i guess', 'maybe', 'probably'
    ];
    
    for (const filler of fillerWords) {
      const regex = new RegExp(`\\b${filler}\\b`, 'gi');
      cleanedMessage = cleanedMessage.replace(regex, '');
    }
    
    cleanedMessage = cleanedMessage.replace(/\s+/g, ' ').trim();
    
    if (!cleanedMessage) {
      return 'New Chat';
    }
    
    let title = cleanedMessage.split(/[.!?]/)[0].trim();
    
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
    console.log('Saving chat to database:', { chatId: chat.id, title: chat.title, userId });
    
    const { error: chatError } = await supabase
      .from('chats')
      .upsert({
        id: chat.id,
        user_id: userId,
        title: chat.title,
        created_at: new Date(chat.created).toISOString(),
        updated_at: new Date(chat.updated).toISOString(),
        thread_id: chat.threadId
      });

    if (chatError) {
      console.error('Supabase error saving chat:', chatError);
      throw chatError;
    }
    
    console.log('Successfully saved chat to database');
  } catch (error) {
    console.error('Error saving chat metadata to Supabase:', error);
    throw error;
  }
}

async function loadUserChats(userId: string): Promise<ChatSession[]> {
  try {
    const { data: chatsData, error: chatsError } = await supabase
      .from('chats')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (chatsError) throw chatsError;

    if (!chatsData || chatsData.length === 0) {
      const defaultChat: ChatSession = {
        id: Date.now().toString(),
        title: 'New Chat',
        created: Date.now(),
        updated: Date.now(),
      };
      
      // Save the default chat to the database
      try {
        await saveChatToDatabase(defaultChat, userId);
        console.log('Created and saved default chat to database');
      } catch (error) {
        console.error('Failed to save default chat:', error);
      }
      
      return [defaultChat];
    }

    const chats: ChatSession[] = chatsData.map(chatData => ({
      id: chatData.id,
      title: chatData.title,
      created: new Date(chatData.created_at).getTime(),
      updated: new Date(chatData.updated_at).getTime(),
      threadId: chatData.thread_id
    }));

    return chats;
  } catch (error) {
    console.error('Error loading chats from Supabase:', error);
    return [{
      id: Date.now().toString(),
      title: 'New Chat',
      created: Date.now(),
      updated: Date.now(),
    }];
  }
}

// Load messages from OpenAI thread
async function loadMessagesFromThread(threadId: string): Promise<ChatMessage[]> {
  try {
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
      updated: Date.now(),
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
  const inputRef = useRef<HTMLInputElement>(null);
  const [authModalOpen, setAuthModalOpen] = useState<false | 'signin' | 'signup'>(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const isCreatingMessage = useRef(false);

  const [lastUserMessage, setLastUserMessage] = useState<string>("");
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');

  const activeChat = chats.find((c) => c.id === activeChatId)!;

  // New chat
  const handleNewChat = useCallback(async () => {
    const newId = Date.now().toString();
    const newChat: ChatSession = {
      id: newId,
      title: 'New Chat',
      created: Date.now(),
      updated: Date.now(),
    };
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newId);
    setSidebarOpen(false);
    setLastUserMessage("");
    
    if (user) {
      try {
        await saveChatToDatabase(newChat, user.id);
      } catch (error) {
        console.error('Error saving new chat:', error);
      }
    }
  }, [user]);

  // Delete chat function
  const handleDeleteChat = useCallback(async (chatId: string) => {
    if (!user) return;
    
    console.log('Attempting to delete chat:', { chatId, userId: user.id });
    console.log('Current chats:', chats.map(c => ({ id: c.id, title: c.title })));
    
    try {
      // Get the current session to get the access token
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      
      if (!accessToken) {
        console.error('No access token available');
        alert('Authentication error. Please sign in again.');
        return;
      }
      
      const response = await fetch('/api/chatbot/delete-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, userId: user.id, accessToken })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Delete response:', result);
        
        setChats(prev => prev.filter(chat => chat.id !== chatId));
        
        // If we're deleting the active chat, switch to the first available chat
        if (chatId === activeChatId) {
          const remainingChats = chats.filter(chat => chat.id !== chatId);
          if (remainingChats.length > 0) {
            setActiveChatId(remainingChats[0].id);
          } else {
            // Create a new chat if no chats remain
            handleNewChat();
          }
        }
        
        setDropdownOpen(null);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to delete chat:', response.status, errorData);
        alert('Failed to delete chat. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting chat:', error);
      alert('Error deleting chat. Please try again.');
    }
  }, [user, activeChatId, chats, handleNewChat]);

  // Rename chat function
  const handleRenameChat = useCallback(async (chatId: string, newTitle: string) => {
    if (!user || !newTitle.trim()) return;
    
    console.log('Attempting to rename chat:', { chatId, userId: user.id, newTitle });
    
    try {
      // Get the current session to get the access token
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      
      if (!accessToken) {
        console.error('No access token available');
        alert('Authentication error. Please sign in again.');
        return;
      }
      
      const response = await fetch('/api/chatbot/rename-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId, userId: user.id, newTitle: newTitle.trim(), accessToken })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Rename response:', result);
        
        setChats(prev => prev.map(chat => 
          chat.id === chatId 
            ? { ...chat, title: newTitle.trim(), updated: Date.now() }
            : chat
        ));
        setEditingChatId(null);
        setEditingTitle('');
        setDropdownOpen(null);
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('Failed to rename chat:', response.status, errorData);
        alert('Failed to rename chat. Please try again.');
      }
    } catch (error) {
      console.error('Error renaming chat:', error);
      alert('Error renaming chat. Please try again.');
    }
  }, [user]);

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

  // Enhanced scroll to bottom
  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [currentMessages, loading, scrollToBottom]);

  // Debug currentMessages changes
  useEffect(() => {
    console.log('Current messages updated:', currentMessages);
    console.log('Messages length:', currentMessages.length);
    if (currentMessages.length > 0) {
      console.log('Last message:', currentMessages[currentMessages.length - 1]);
    }
  }, [currentMessages]);

  // Keyboard shortcuts and click outside handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K for new chat
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        handleNewChat();
      }
      // Cmd/Ctrl + L to focus input
      if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      // Escape to close sidebar or dropdown
      if (e.key === 'Escape') {
        if (sidebarOpen) {
          setSidebarOpen(false);
        }
        if (dropdownOpen) {
          setDropdownOpen(null);
        }
        if (editingChatId) {
          setEditingChatId(null);
          setEditingTitle('');
        }
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Element;
      
      // Close dropdown if clicking outside the dropdown or chat container
      if (dropdownOpen && !target.closest('.group\\/chat') && !target.closest('[data-dropdown]')) {
        setDropdownOpen(null);
      }
      
      // Close editing if clicking outside
      if (editingChatId && !target.closest('.group\\/chat')) {
        setEditingChatId(null);
        setEditingTitle('');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleClickOutside);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleClickOutside);
    };
  }, [sidebarOpen, dropdownOpen, editingChatId, handleNewChat]);

  // Enhanced message sending with better error handling
  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      setAuthModalOpen('signin');
      return;
    }
    if (!input.trim() || loading) return;
    
    const userMsg: ChatMessage = { 
      sender: "user", 
      text: input,
      timestamp: Date.now()
    };
    
    const isFirstUserMessage = currentMessages.filter(msg => msg.sender === 'user').length === 0;
    
    setCurrentMessages(prev => [...prev, userMsg]);
    setLastUserMessage(input);
    setInput("");
    setLoading(true);
    
    let newTitle = '';
    if (isFirstUserMessage) {
      newTitle = await generateChatTitle(input);
      setChats((prev) => prev.map(chat =>
        chat.id === activeChatId
          ? { ...chat, title: newTitle }
          : chat
      ));
    }
    
    if (isCreatingMessage.current) {
      console.log('Already creating message, skipping');
      return;
    }
    
    isCreatingMessage.current = true;
    const loadingMessageId = `${activeChatId}-${Date.now()}`;
    console.log('Creating initial bot message with ID:', loadingMessageId);
    setCurrentMessages(prev => {
      // Check if we already have a bot message with empty text (loading state)
      const hasLoadingMessage = prev.some(msg => msg.sender === 'bot' && msg.text === '');
      if (hasLoadingMessage) {
        console.log('Loading message already exists, skipping creation');
        isCreatingMessage.current = false;
        return prev;
      }
      const newMessages = [...prev, { sender: "bot", text: "", id: loadingMessageId }];
      console.log('Initial bot message created:', newMessages[newMessages.length - 1]);
      return newMessages;
    });
    
    try {
      let receivedThreadId = activeChat.threadId;
      
      await queryStream(
        { question: userMsg.text, threadId: activeChat.threadId },
        (text) => {
          // Append each character immediately for real-time streaming
          console.log('Received character:', text);
          setCurrentMessages(prev => {
            const lastMessage = prev[prev.length - 1];
            const newText = (lastMessage?.text || "") + text;
            console.log('Updated text:', newText);
            const newMessage = { 
              sender: "bot", 
              text: newText, 
              id: loadingMessageId 
            };
            console.log('New message object:', newMessage);
            return [
              ...prev.slice(0, -1),
              newMessage
            ];
          });
        },
        (threadId) => {
          receivedThreadId = threadId;
        },
        (error) => {
          throw new Error(error);
        }
      );
      
      // Update chat with thread ID and updated timestamp
      const updatedChat = { 
        ...activeChat, 
        threadId: receivedThreadId,
        title: newTitle || activeChat.title,
        updated: Date.now()
      };
      setChats((prev) => prev.map(chat =>
        chat.id === activeChatId
          ? updatedChat
          : chat
      ));
      
      if (user) {
        try {
          await saveChatToDatabase(updatedChat, user.id);
        } catch (error) {
          console.error('Error saving chat with threadId:', error);
        }
      }
      
    } catch (err) {
      setCurrentMessages(prev => [
        ...prev.slice(0, -1),
        { 
          sender: "bot", 
          text: "Sorry, there was an error processing your request. Please try again.", 
          id: loadingMessageId,
          isError: true, 
          Error: err
        }
      ]);
    } finally {
      setLoading(false);
      isCreatingMessage.current = false;
    }
  }

  // Regenerate last response
  const handleRegenerate = useCallback(async () => {
    if (!lastUserMessage || loading) return;
    
    setLoading(true);
    const loadingMessageId = `${activeChatId}-${Date.now()}`;
    
    // Remove the last bot message
    setCurrentMessages(prev => {
      const newMessages = [...prev];
      const lastBotIndex = newMessages.findLastIndex(msg => msg.sender === 'bot');
      if (lastBotIndex !== -1) {
        newMessages.splice(lastBotIndex, 1);
      }
      newMessages.push({ sender: "bot", text: "", id: loadingMessageId });
      return newMessages;
    });
    
    try {
      await queryStream(
        { question: lastUserMessage, threadId: activeChat.threadId },
        (text) => {
          // Append each character immediately for real-time streaming
          console.log('Regenerate - Received character:', text);
          setCurrentMessages(prev => {
            const lastMessage = prev[prev.length - 1];
            const newText = (lastMessage?.text || "") + text;
            console.log('Regenerate - Updated text:', newText);
            return [
              ...prev.slice(0, -1),
              { 
                sender: "bot", 
                text: newText, 
                id: loadingMessageId 
              }
            ];
          });
        },
        () => {}, // No thread ID update needed for regeneration
        (error) => {
          throw new Error(error);
        }
      );
      
      // Update the chat's updated timestamp
      const updatedChat = { 
        ...activeChat, 
        updated: Date.now()
      };
      setChats((prev) => prev.map(chat =>
        chat.id === activeChatId
          ? updatedChat
          : chat
      ));
      
      if (user) {
        try {
          await saveChatToDatabase(updatedChat, user.id);
        } catch (error) {
          console.error('Error saving regenerated chat:', error);
        }
      }
      
    } catch (err) {
      setCurrentMessages(prev => [
        ...prev.slice(0, -1),
        { 
          sender: "bot", 
          text: "Sorry, there was an error processing your request. Please try again.", 
          id: loadingMessageId,
          isError: true,
          Error: err
        }
      ]);
    } finally {
      setLoading(false);
    }
  }, [lastUserMessage, loading, activeChatId, activeChat, user]);

  // Copy message to clipboard
  const handleCopyMessage = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Show a brief success indicator
      console.log('Message copied to clipboard');
    } catch (err) {
      console.error('Failed to copy message:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      console.log('Message copied to clipboard (fallback)');
    }
  }, []);

  // Handle image upload
  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setCurrentMessages(prev => [...prev, { sender: "user", text: "", image: event.target?.result as string }]);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  // Load user chats when user logs in
  useEffect(() => {
    if (user) {
      loadUserChats(user.id).then(loadedChats => {
        console.log('Loaded chats from database:', loadedChats.map(c => ({ id: c.id, title: c.title })));
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

      {/* Enhanced Sidebar */}
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
              title="New Chat (⌘K)"
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
            <div
              key={chat.id}
              className={`relative group/chat w-full px-3 py-3 border border-transparent hover:border-blue-200 hover:bg-blue-50/50 transition-all duration-200 rounded-xl mb-2 ${
                chat.id === activeChatId ? 'bg-blue-100/70 border-blue-200 shadow-sm' : ''
              }`}
            >
              {/* Chat content */}
              <div className="flex items-center justify-between">
                <button
                  className="flex-1 text-left flex flex-col"
                  onClick={() => { setActiveChatId(chat.id); setSidebarOpen(false); }}
                >
                  {editingChatId === chat.id ? (
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleRenameChat(chat.id, editingTitle);
                        } else if (e.key === 'Escape') {
                          setEditingChatId(null);
                          setEditingTitle('');
                        }
                      }}
                      onBlur={() => {
                        if (editingTitle.trim()) {
                          handleRenameChat(chat.id, editingTitle);
                        } else {
                          setEditingChatId(null);
                          setEditingTitle('');
                        }
                      }}
                      className="font-medium text-blue-900 text-sm bg-transparent border-none outline-none focus:ring-0"
                      autoFocus
                    />
                  ) : (
                    <span className="font-medium text-blue-900 truncate text-sm">{chat.title}</span>
                  )}
                  <span className="text-xs text-blue-400 mt-1">{formatDate(chat.updated)}</span>
                </button>
                
                {/* Three dots button - always show on hover */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setDropdownOpen(dropdownOpen === chat.id ? null : chat.id);
                  }}
                  className="opacity-0 group-hover/chat:opacity-100 transition-opacity duration-200 p-1 hover:bg-blue-200 rounded-full"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-blue-600">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
              </div>

              {/* Dropdown menu */}
              {dropdownOpen === chat.id && (
                <div data-dropdown className="absolute right-0 top-full mt-1 bg-white border border-blue-200 rounded-lg shadow-lg z-50 min-w-[120px]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingChatId(chat.id);
                      setEditingTitle(chat.title);
                      setDropdownOpen(null);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-blue-700 hover:bg-blue-50 flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                    Rename
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Are you sure you want to delete this chat? This action cannot be undone.')) {
                        handleDeleteChat(chat.id);
                      }
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="hidden lg:block p-4 border-t border-blue-100/50 text-xs text-blue-400">
          {new Date().getFullYear()} First Glass of Arkansas
          <br />
          Powered by <a href="https://longspan.ai" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline hover:text-blue-800 transition-colors"><b>Longspan</b></a>
        </div>
      </aside>

      {/* Enhanced Main Chat Area */}
      <main className="flex-1 flex flex-col h-screen min-h-0 relative">
        {/* Enhanced Header */}
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

        {/* Enhanced Chat Messages */}
        <div className="flex-1 overflow-y-auto bg-gradient-to-b from-blue-50/30 to-white px-4 py-6 min-h-0 pb-4">
          <div className="max-w-4xl mx-auto flex flex-col gap-4">
            {currentMessages.map((msg, idx) => (
              <div
                key={`${msg.id || idx}-${msg.text.length}`}
                className={`group flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-4 py-3 shadow-sm relative ${
                    msg.sender === "user"
                      ? "bg-blue-600 text-white"
                      : msg.isError
                      ? "bg-red-50 border border-red-200 text-red-800"
                      : "bg-white border border-blue-100 text-gray-800"
                  }`}
                >
                  {msg.image && (
            <Image
                      src={msg.image}
                      alt="Uploaded"
                      width={300}
                      height={200}
                      className="max-w-full h-auto rounded-lg mb-2"
                    />
                  )}
                  <div className="whitespace-pre-wrap">
                                          {msg.sender === "bot" ? (
                        <div className="prose prose-sm max-w-none">
                          {msg.text ? processTextWithCitations(msg.text) : <TypingDots />}
                        </div>
                      ) : (
                      msg.text
                    )}
                  </div>
                  {msg.sender === "bot" && (
                    <MessageActions
                      message={msg}
                      onCopy={() => handleCopyMessage(msg.text)}
                      onRegenerate={idx === currentMessages.length - 1 ? handleRegenerate : undefined}
                    />
                  )}
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

        {/* Enhanced Input Area */}
        <div className="bg-white/80 backdrop-blur-sm border-t border-blue-100/50 p-4 flex-shrink-0 z-20">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSend} className="flex gap-3">
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
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
