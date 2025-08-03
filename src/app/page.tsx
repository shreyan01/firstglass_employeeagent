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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative animate-fadeIn border border-gray-100">
        {/* Close button */}
        <button
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-2xl font-bold transition-colors duration-200 hover:scale-110"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mb-4">
            <Image
              src="/logo.png"
              alt="First Glass Logo"
              width={80}
              height={40}
              className="mx-auto"
            />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Welcome to First Glass</h2>
          <p className="text-gray-600 text-sm">Sign in to access your AI assistant</p>
        </div>

        {/* Tab buttons */}
        <div className="flex mb-8 bg-gray-100 rounded-xl p-1">
          <button
            className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 ${
              tab === 'signin' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
            onClick={() => setTab('signin')}
          >
            Sign In
          </button>
          <button
            className={`flex-1 py-3 px-4 rounded-lg font-semibold text-sm transition-all duration-200 ${
              tab === 'signup' 
                ? 'bg-white text-blue-600 shadow-sm' 
                : 'text-gray-600 hover:text-gray-800'
            }`}
            onClick={() => setTab('signup')}
          >
            Sign Up
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-red-500">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <span className="text-red-700 text-sm font-medium">{error}</span>
            </div>
          </div>
        )}

        {/* Google Auth Button */}
        <button
          type="button"
          className="flex items-center justify-center gap-3 w-full py-3 mb-6 rounded-xl border-2 border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:border-gray-300 hover:shadow-sm"
          onClick={handleGoogleAuth}
          disabled={loading}
        >
          <FcGoogle className="w-5 h-5" />
          {tab === 'signin' ? 'Sign in with Google' : 'Sign up with Google'}
        </button>

        {/* Divider */}
        <div className="flex items-center mb-6">
          <div className="flex-1 h-px bg-gray-200"></div>
          <span className="px-4 text-sm text-gray-500">or continue with email</span>
          <div className="flex-1 h-px bg-gray-200"></div>
        </div>

        {/* Form */}
        {tab === 'signin' ? (
          <form className="space-y-4" onSubmit={handleEmailAuth}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input 
                name="email" 
                type="email" 
                placeholder="Enter your email" 
                required 
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input 
                name="password" 
                type="password" 
                placeholder="Enter your password" 
                required 
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" 
              />
            </div>
            <button 
              type="submit" 
              className="w-full py-3 px-6 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg" 
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <Spinner />
                  <span>Signing in...</span>
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        ) : (
          <form className="space-y-4" onSubmit={handleEmailAuth}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
              <input 
                name="name" 
                type="text" 
                placeholder="Enter your full name" 
                required 
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <input 
                name="email" 
                type="email" 
                placeholder="Enter your email" 
                required 
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <input 
                name="password" 
                type="password" 
                placeholder="Create a password" 
                required 
                minLength={6} 
                className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200" 
              />
            </div>
            <button 
              type="submit" 
              className="w-full py-3 px-6 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg" 
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <Spinner />
                  <span>Creating account...</span>
                </div>
              ) : (
                'Sign Up'
              )}
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            {tab === 'signin' ? "Don't have an account? " : "Already have an account? "}
            <button 
              type="button" 
              className="text-blue-600 font-medium hover:text-blue-700 underline transition-colors duration-200" 
              onClick={() => setTab(tab === 'signin' ? 'signup' : 'signin')}
            >
              {tab === 'signin' ? 'Sign Up' : 'Sign In'}
            </button>
          </p>
        </div>
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

function SuggestedQuestions({ onQuestionClick, userId }: { onQuestionClick: (question: string) => void, userId?: string }) {
  // Generate dynamic prompts based on user and session
  const generateDynamicPrompts = () => {
    const basePrompts = [
      "What are First Glass's safety policies?",
      "How do I report an incident?",
      "What are the company benefits?",
      "How do I request time off?",
      "What is the dress code policy?",
      "How do I access my paystub?",
      "What are the overtime policies?",
      "How do I submit an expense report?",
      "What are the training requirements?",
      "How do I contact HR?",
      "What are the break time policies?",
      "How do I update my personal information?",
      "What are the performance review processes?",
      "How do I request equipment or supplies?",
      "What are the social media policies?",
      "How do I report harassment or discrimination?",
      "What are the emergency procedures?",
      "How do I access company resources?",
      "What are the travel and expense policies?",
      "How do I request a schedule change?"
    ];

    // Create a seed based on user ID and current session
    const userSeed = userId ? userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
    const sessionSeed = Math.floor(Date.now() / (1000 * 60 * 60)); // Changes every hour
    let combinedSeed = userSeed + sessionSeed;

    // Shuffle array using the seed
    const shuffled = [...basePrompts].sort(() => {
      const x = Math.sin(combinedSeed++) * 10000;
      return x - Math.floor(x);
    });

    // Return 4 unique prompts
    return shuffled.slice(0, 4);
  };

  const dynamicPrompts = generateDynamicPrompts();

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-gray-700 mb-3">Suggested questions for you:</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
        {dynamicPrompts.map((question, index) => (
          <button
            key={index}
            onClick={() => onQuestionClick(question)}
            className="text-left p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors duration-200 text-sm text-gray-700 bg-white shadow-sm hover:shadow-md"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  // Chat state - Always start with a new chat
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>('');
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAppLoaded, setIsAppLoaded] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [authModalOpen, setAuthModalOpen] = useState<false | 'signin' | 'signup'>(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const isCreatingMessage = useRef(false);

  const [lastUserMessage, setLastUserMessage] = useState<string>("");
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');

  const activeChat = chats.find((c) => c.id === activeChatId);

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
    setCurrentMessages([]); // Clear messages to show suggested questions
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
    } else if (activeChat) {
      setCurrentMessages([{ sender: "bot", text: "Hi! How can I help you today?" }]);
    } else {
      setCurrentMessages([]);
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
    if (!input.trim() || loading || !activeChat) return;
    
    const userMsg: ChatMessage = { 
      sender: "user", 
      text: input,
      id: `${activeChatId}-${Date.now()}`,
      timestamp: Date.now()
    };
    
    const userInput = input;
    setInput("");
    setLastUserMessage(userInput);
    
    // Add user message to chat
    setCurrentMessages(prev => [...prev, userMsg]);
    
    // Generate title from first message
    let newTitle = activeChat.title;
    if (activeChat.title === 'New Chat') {
      try {
        newTitle = await generateChatTitle(userInput);
      } catch (error) {
        console.error('Error generating title:', error);
      }
    }
    
    setLoading(true);
    isCreatingMessage.current = true;
    const loadingMessageId = `${activeChatId}-${Date.now()}`;
    
    // Add initial bot message
    setCurrentMessages(prev => {
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
      const updatedChat: ChatSession = { 
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
    if (!lastUserMessage || loading || !activeChat) return;
    
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
            const newMessage = { 
              sender: "bot", 
              text: newText, 
              id: loadingMessageId 
            };
            return [
              ...prev.slice(0, -1),
              newMessage
            ];
          });
        },
        (threadId) => {
          // Update chat with new thread ID if needed
          if (threadId !== activeChat.threadId) {
            const updatedChat: ChatSession = { 
              ...activeChat, 
              threadId: threadId,
              updated: Date.now()
            };
            setChats((prev) => prev.map(chat =>
              chat.id === activeChatId
                ? updatedChat
                : chat
            ));
            
            if (user) {
              saveChatToDatabase(updatedChat, user.id).catch(error => {
                console.error('Error saving regenerated chat:', error);
              });
            }
          }
        },
        (error) => {
          throw new Error(error);
        }
      );
    } catch (err) {
      setCurrentMessages(prev => [
        ...prev.slice(0, -1),
        { 
          sender: "bot", 
          text: "Sorry, there was an error regenerating the response. Please try again.", 
          id: loadingMessageId,
          isError: true 
        }
      ]);
    } finally {
      setLoading(false);
    }
  }, [lastUserMessage, loading, activeChat, activeChatId, user]);

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

  // Track Supabase auth session
  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsAppLoaded(true);
    });
    return () => { listener?.subscription.unsubscribe(); };
  }, []);

  // Handle sign out with proper error handling
  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Sign out error:', error);
        alert('Failed to sign out. Please try again.');
      } else {
        // Clear local state
        setUser(null);
        const newChat: ChatSession = {
          id: Date.now().toString(),
          title: 'New Chat',
          created: Date.now(),
          updated: Date.now(),
        };
        setChats([newChat]);
        setActiveChatId(newChat.id);
        setCurrentMessages([{ sender: "bot", text: "Hi! How can I help you today?" }]);
        setInput("");
        setSidebarOpen(false);
        setDropdownOpen(null);
        setEditingChatId(null);
        setEditingTitle('');
      }
    } catch (error) {
      console.error('Sign out error:', error);
      alert('Failed to sign out. Please try again.');
    }
  };

  // Load user chats when user changes
  useEffect(() => {
    if (user) {
      loadUserChats(user.id).then(userChats => {
        if (userChats.length > 0) {
          setChats(userChats);
          setActiveChatId(userChats[0].id);
        } else {
          // Create a new chat for new users
          handleNewChat();
        }
      });
    } else {
      // Reset to default state when user signs out
      const newChat: ChatSession = {
        id: Date.now().toString(),
        title: 'New Chat',
        created: Date.now(),
        updated: Date.now(),
      };
      setChats([newChat]);
      setActiveChatId(newChat.id);
      setCurrentMessages([]); // Clear messages to show suggested questions
    }
  }, [user]);

  // Save chat to database when it changes
  useEffect(() => {
    if (activeChat && user) {
      saveChatToDatabase(activeChat, user.id).catch(error => {
        console.error('Error saving chat:', error);
      });
    }
  }, [activeChat, user]);

  const handleSuggestedQuestion = async (question: string) => {
    // Automatically send the suggested question
    if (!user) {
      setAuthModalOpen('signin');
      return;
    }
    if (!activeChat) return;
    
    const userMsg: ChatMessage = { 
      sender: "user", 
      text: question,
      id: `${activeChatId}-${Date.now()}`,
      timestamp: Date.now()
    };
    
    setLastUserMessage(question);
    
    // Add user message to chat
    setCurrentMessages(prev => [...prev, userMsg]);
    
    // Generate title from first message
    let newTitle = activeChat.title;
    if (activeChat.title === 'New Chat') {
      try {
        newTitle = await generateChatTitle(question);
      } catch (error) {
        console.error('Error generating title:', error);
      }
    }
    
    setLoading(true);
    isCreatingMessage.current = true;
    const loadingMessageId = `${activeChatId}-${Date.now()}`;
    
    // Add initial bot message
    setCurrentMessages(prev => {
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
          console.log('Stream completed, thread ID:', threadId);
        },
        (error) => {
          console.error('Stream error:', error);
          setCurrentMessages(prev => {
            const lastMessage = prev[prev.length - 1];
            return [
              ...prev.slice(0, -1),
              { 
                sender: "bot", 
                text: "I apologize, but I encountered an error processing your request. Please try again.", 
                id: loadingMessageId,
                isError: true
              }
            ];
          });
        }
      );
      
      // Update chat with new thread ID and title
      const updatedChat: ChatSession = {
        ...activeChat,
        threadId: receivedThreadId,
        title: newTitle,
        updated: Date.now()
      };
      
      setChats(prev => 
        prev.map(chat => 
          chat.id === activeChatId ? updatedChat : chat
        )
      );
      
      // Save to database
      if (user) {
        await saveChatToDatabase(updatedChat, user.id);
      }
      
    } catch (error) {
      console.error('Error in handleSuggestedQuestion:', error);
      setCurrentMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        return [
          ...prev.slice(0, -1),
          { 
            sender: "bot", 
            text: "I apologize, but I encountered an error processing your request. Please try again.", 
            id: loadingMessageId,
            isError: true
          }
        ];
      });
    } finally {
      setLoading(false);
      isCreatingMessage.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Main Layout - Blue Sidebar + White Chat Area */}
      <div className="flex h-screen">
        {/* Blue Sidebar - Fixed width on desktop, loading screen on mobile */}
        <div className="hidden lg:flex w-80 flex-col relative overflow-hidden">
          {/* Enhanced Gradient Background with Dynamic Lamp Effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-blue-600 to-blue-900">
            {/* Dynamic Lamp Effect - Top Light */}
            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-40 h-40 bg-gradient-to-t from-blue-500 via-blue-600 to-black rounded-full blur-xl animate-lamp-glow"></div>
            
            {/* Dynamic Lamp Effect - Bottom Glow */}
            <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-56 h-56 bg-gradient-to-t from-blue-600 via-blue-700 to-black rounded-full blur-2xl animate-lamp-glow-delayed"></div>
            
            {/* Enhanced Pattern Overlay */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/15 to-blue-800/30"></div>
            
            {/* Dynamic Animated Light Rays */}
            <div className="absolute top-0 left-0 w-full h-full">
              <div className="absolute top-8 left-8 w-1 h-20 bg-gradient-to-b from-blue-200/80 to-transparent transform rotate-12 animate-light-ray-1"></div>
              <div className="absolute top-12 left-16 w-1 h-16 bg-gradient-to-b from-blue-200/60 to-transparent transform -rotate-6 animate-light-ray-2"></div>
              <div className="absolute top-6 left-24 w-1 h-18 bg-gradient-to-b from-blue-200/70 to-transparent transform rotate-45 animate-light-ray-3"></div>
              <div className="absolute top-16 left-12 w-1 h-14 bg-gradient-to-b from-blue-300/50 to-transparent transform rotate-30 animate-light-ray-4"></div>
              <div className="absolute top-4 left-20 w-1 h-12 bg-gradient-to-b from-blue-300/40 to-transparent transform -rotate-15 animate-light-ray-5"></div>
            </div>
          </div>

          {/* Content Overlay */}
          <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center">
            <div className="mb-8">
              <Image
                src="/logo.png"
                alt="First Glass Logo"
                width={120}
                height={60}
                className="mb-2 drop-shadow-lg"
              />
              <p className="text-sm text-blue-100 font-medium tracking-wide">QUALITY THAT IS TRANSPARENT</p>
            </div>
            <div className="text-white text-center">
              <p className="text-lg font-semibold mb-1 drop-shadow-sm">First Glass Assistant AI</p>
              <p className="text-sm text-blue-100">Employee Assistant</p>
            </div>
          </div>

          {/* Enhanced Decorative Element */}
          <div className="absolute bottom-6 left-6 z-10">
            <div className="relative">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg transform rotate-45 shadow-lg">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-400 to-blue-500 rounded-lg transform rotate-45 absolute top-1 left-1 shadow-inner"></div>
              </div>
              {/* Glow effect */}
              <div className="absolute inset-0 w-12 h-12 bg-blue-400/30 rounded-lg transform rotate-45 blur-sm animate-pulse"></div>
            </div>
          </div>

          {/* Hamburger Menu Button with Enhanced Styling */}
          <div className="absolute top-6 right-6 z-10">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-white hover:text-blue-100 transition-all duration-200 p-2 rounded-lg hover:bg-white/10 backdrop-blur-sm"
              title="Chat history"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </button>
          </div>

          {/* Chat History Dropdown */}
          {sidebarOpen && (
            <div className="absolute right-4 top-20 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[280px] max-h-[400px] overflow-y-auto">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                <span className="font-bold text-gray-900 text-lg">Chats</span>
                <button
                  className="bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full p-2 transition-colors duration-200"
                  onClick={handleNewChat}
                  title="New Chat"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
              <div className="p-2">
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
                            className="font-medium text-gray-900 text-sm bg-transparent border-none outline-none focus:ring-0"
                            autoFocus
                          />
                        ) : (
                          <span className="font-medium text-gray-900 truncate text-sm">{chat.title}</span>
                        )}
                        <span className="text-xs text-gray-400 mt-1">{formatDate(chat.updated)}</span>
                      </button>
                      
                      {/* Three dots button for individual chat actions */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDropdownOpen(dropdownOpen === chat.id ? null : chat.id);
                        }}
                        className="opacity-0 group-hover/chat:opacity-100 transition-opacity duration-200 p-1 hover:bg-gray-200 rounded-full"
                      >
                        <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                        </svg>
                      </button>
                    </div>

                    {/* Individual chat dropdown menu */}
                    {dropdownOpen === chat.id && (
                      <div data-dropdown className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[120px]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingChatId(chat.id);
                            setEditingTitle(chat.title);
                            setDropdownOpen(null);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
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
              <div className="p-4 border-t border-gray-200 text-xs text-gray-400">
                {new Date().getFullYear()} First Glass of Arkansas
                <br />
                Powered by <a href="https://longspan.ai" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline hover:text-blue-800 transition-colors"><b>Longspan</b></a>
              </div>
            </div>
          )}
        </div>

        {/* Mobile Loading Screen - Blue sidebar on mobile */}
        {!isAppLoaded && (
          <div className="lg:hidden fixed inset-0 flex flex-col items-center justify-center z-50 overflow-hidden">
            {/* Enhanced Gradient Background with Dynamic Lamp Effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500 via-blue-600 to-blue-900">
              {/* Dynamic Lamp Effect - Top Light */}
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-40 h-40 bg-gradient-to-t from-blue-500 via-blue-600 to-black rounded-full blur-xl animate-lamp-glow"></div>
              
              {/* Dynamic Lamp Effect - Bottom Glow */}
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-56 h-56 bg-gradient-to-t from-blue-600 via-blue-700 to-black rounded-full blur-2xl animate-lamp-glow-delayed"></div>
              
              {/* Enhanced Pattern Overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-500/15 to-blue-800/30"></div>
              
              {/* Dynamic Animated Light Rays */}
              <div className="absolute top-0 left-0 w-full h-full">
                <div className="absolute top-8 left-8 w-1 h-20 bg-gradient-to-b from-blue-200/80 to-transparent transform rotate-12 animate-light-ray-1"></div>
                <div className="absolute top-12 left-16 w-1 h-16 bg-gradient-to-b from-blue-200/60 to-transparent transform -rotate-6 animate-light-ray-2"></div>
                <div className="absolute top-6 left-24 w-1 h-18 bg-gradient-to-b from-blue-200/70 to-transparent transform rotate-45 animate-light-ray-3"></div>
                <div className="absolute top-16 left-12 w-1 h-14 bg-gradient-to-b from-blue-300/50 to-transparent transform rotate-30 animate-light-ray-4"></div>
                <div className="absolute top-4 left-20 w-1 h-12 bg-gradient-to-b from-blue-300/40 to-transparent transform -rotate-15 animate-light-ray-5"></div>
              </div>
            </div>
            
            {/* Content Overlay */}
            <div className="relative z-10 text-center">
              <Image
                src="/logo.png"
                alt="First Glass Logo"
                width={120}
                height={60}
                className="mb-4 drop-shadow-lg"
              />
              <p className="text-white text-lg font-semibold mb-2 drop-shadow-sm">First Glass Assistant AI</p>
              <p className="text-blue-100 text-sm">Employee Assistant</p>
            </div>
          </div>
        )}

        {/* White Chat Area - Takes remaining space */}
        <div className="flex-1 flex flex-col bg-white">
          {/* Authentication Header */}
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200">
            {/* Mobile Chat History Button */}
            <div className="lg:hidden flex items-center gap-2">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-gray-600 hover:text-gray-800 transition-colors duration-200"
                title="Chat history"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
              </button>
              
              {/* Mobile Chat History Dropdown */}
              {sidebarOpen && (
                <div className="absolute left-4 top-16 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[280px] max-h-[400px] overflow-y-auto">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                    <span className="font-bold text-gray-900 text-lg">Chats</span>
                    <button
                      className="bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full p-2 transition-colors duration-200"
                      onClick={handleNewChat}
                      title="New Chat"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                  <div className="p-2">
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
                                className="font-medium text-gray-900 text-sm bg-transparent border-none outline-none focus:ring-0"
                                autoFocus
                              />
                            ) : (
                              <span className="font-medium text-gray-900 truncate text-sm">{chat.title}</span>
                            )}
                            <span className="text-xs text-gray-400 mt-1">{formatDate(chat.updated)}</span>
                          </button>
                          
                          {/* Three dots button for individual chat actions */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDropdownOpen(dropdownOpen === chat.id ? null : chat.id);
                            }}
                            className="opacity-0 group-hover/chat:opacity-100 transition-opacity duration-200 p-1 hover:bg-gray-200 rounded-full"
                          >
                            <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                          </button>
                        </div>

                        {/* Individual chat dropdown menu */}
                        {dropdownOpen === chat.id && (
                          <div data-dropdown className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[120px]">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingChatId(chat.id);
                                setEditingTitle(chat.title);
                                setDropdownOpen(null);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
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
                  <div className="p-4 border-t border-gray-200 text-xs text-gray-400">
                    {new Date().getFullYear()} First Glass of Arkansas
                    <br />
                    Powered by <a href="https://longspan.ai" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline hover:text-blue-800 transition-colors"><b>Longspan</b></a>
                  </div>
                </div>
              )}
            </div>

            {/* Authentication Buttons */}
            <div className="flex items-center gap-3">
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-2 text-sm text-gray-600 bg-gray-50 px-3 py-1.5 rounded-lg">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="font-medium">{user.email}</span>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 px-4 py-2 rounded-lg font-medium transition-all duration-200 border border-red-200 hover:border-red-300"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAuthModalOpen('signin')}
                    className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-600 hover:text-blue-700 px-4 py-2 rounded-lg font-medium transition-all duration-200 border border-blue-200 hover:border-blue-300"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m-3-6l3-3m0 0l-3-3m3 3H9" />
                    </svg>
                    Sign In
                  </button>
                  <button
                    onClick={() => setAuthModalOpen('signup')}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM3 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 019.374 21c-2.331 0-4.525-.648-6.374-1.766z" />
                    </svg>
                    Sign Up
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Chat Messages Area */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="max-w-4xl mx-auto space-y-4">
              {currentMessages.length === 0 && (
                <div className="text-center py-8">
                  <SuggestedQuestions onQuestionClick={handleSuggestedQuestion} userId={user?.id} />
                </div>
              )}
              
              {currentMessages.map((msg, idx) => (
                <div
                  key={msg.id || idx}
                  className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
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
            </div>
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 px-6 py-4">
            <div className="max-w-4xl mx-auto">
              <form onSubmit={handleSend} className="flex items-center gap-3">
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type here"
                    className="w-full resize-none rounded-xl border text-black border-gray-300 px-4 py-3 pr-12 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-colors duration-200"
                    rows={1}
                    style={{ minHeight: '48px', maxHeight: '120px' }}
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
              <p className="text-xs text-gray-500 mt-2 text-center">
                By chatting, you agree to AI Terms of Use.
              </p>
            </div>
          </div>
        </div>
      </div>

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
