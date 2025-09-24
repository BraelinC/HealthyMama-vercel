import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send, MessageSquare, Plus, TestTube2, Brain, Zap, Settings, Info, Eye, ChevronDown, Menu, X } from "lucide-react";
import ReactMarkdown from 'react-markdown';
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Badge } from "../ui/badge";
import { Separator } from "../ui/separator";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import CommunityChat from "./CommunityChat";

interface Mem0ChatProps {
  communityId: number;
}

type ApiMessage = {
  id: number;
  role: "user" | "assistant" | "system";
  content: string;
  created_at?: string;
};

type Session = {
  id: string;
  title?: string | null;
  last_message_at?: string;
};

type MemoryContext = {
  content: string;
  metadata?: {
    type?: string;
    importance?: number;
    timestamp?: number;
  };
};

export default function Mem0Chat({ communityId }: Mem0ChatProps) {
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [memoryContext, setMemoryContext] = useState<MemoryContext[]>([]);
  const [contextUsed, setContextUsed] = useState(0);
  const [showMemoryInsights, setShowMemoryInsights] = useState(false);
  const [memoryInsights, setMemoryInsights] = useState<any>(null);
  const [showSystemPrompt, setShowSystemPrompt] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState<string>("");
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [savingPrompt, setSavingPrompt] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);

  const authHeaders = useMemo(() => {
    const token = localStorage.getItem("auth_token");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    } as Record<string, string>;
  }, []);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    endRef.current?.scrollIntoView({ behavior });
  };

  const isNearBottom = () => {
    const container = messagesContainerRef.current;
    if (!container) return true;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const threshold = 100; // pixels from bottom
    return scrollHeight - scrollTop - clientHeight < threshold;
  };

  const handleScroll = () => {
    setShouldAutoScroll(isNearBottom());
  };

  useEffect(() => {
    // Only auto-scroll if user is near the bottom AND not currently streaming
    if (shouldAutoScroll && !loading) {
      scrollToBottom();
    }
  }, [messages, shouldAutoScroll, loading]);

  useEffect(() => {
    loadUltraThinkSessions();
    loadMemoryInsights();
    loadCommunityAIConfig();
  }, [communityId]);

  const loadUltraThinkSessions = async () => {
    setLoadingSessions(true);
    try {
      const response = await fetch(`/api/mem0/chat/sessions?communityId=${communityId}`, {
        headers: authHeaders,
      });
      if (response.ok) {
        const data = await response.json();
        setSessions(data || []);
      }
    } catch (error) {
      console.error('Failed to load UltraThink sessions:', error);
    }
    setLoadingSessions(false);
  };

  const loadMemoryInsights = async () => {
    try {
      const response = await fetch('/api/mem0/memory/insights', {
        headers: authHeaders,
      });
      if (response.ok) {
        const insights = await response.json();
        setMemoryInsights(insights);
      }
    } catch (error) {
      console.error('Failed to load memory insights:', error);
    }
  };

  const loadCommunityAIConfig = async () => {
    try {
      const response = await fetch(`/api/communities/${communityId}/ai-config`, {
        headers: authHeaders,
      });
      if (response.ok) {
        const data = await response.json();
        setSystemPrompt(data?.config?.system_prompt || "");
      }
    } catch (error) {
      console.error('Failed to load AI config:', error);
    }
  };

  const loadSessionHistory = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/mem0/chat/history?sessionId=${sessionId}&communityId=${communityId}`, {
        headers: authHeaders,
      });
      if (response.ok) {
        const history = await response.json();
        setMessages(history || []);
        setActiveSessionId(sessionId);
      }
    } catch (error) {
      console.error('Failed to load session history:', error);
    }
  };

  const sendUltraThinkMessage = async () => {
    if (!inputValue.trim()) return;

    setLoading(true);
    const userMessage = inputValue;
    setInputValue('');

    // Add user message immediately for better UX
    const userMessageId = Date.now();
    setMessages(prev => [...prev, {
      id: userMessageId,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString()
    }]);

    // Add placeholder for assistant response with different ID after small delay
    const assistantMessageId = Date.now() + 1000; // Ensure different ID
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString()
      }]);
    }, 50); // Small delay to ensure user message is rendered first

    // Wait a bit for the assistant placeholder to be added
    await new Promise(resolve => setTimeout(resolve, 100));

    try {
      // Use streaming endpoint
      const response = await fetch('/api/mem0/chat/stream', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          communityId,
          message: userMessage,
          sessionId: activeSessionId
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Process Server-Sent Events stream
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedResponse = '';

      if (!reader) {
        throw new Error('Response body is not readable');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const decodedText = decoder.decode(value, { stream: true });
        buffer += decodedText;
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === 'chunk') {
                // Stream text chunk - update the assistant message
                accumulatedResponse += parsed.data;
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessageId
                    ? { ...msg, content: accumulatedResponse }
                    : msg
                ));
              } else if (parsed.type === 'complete') {
                // Final result with metadata
                setMemoryContext(parsed.data.memoryContext || []);
                setContextUsed(parsed.data.contextUsed || 0);

                // Update session if new
                if (parsed.data.sessionId && parsed.data.sessionId !== activeSessionId) {
                  setActiveSessionId(parsed.data.sessionId);
                  loadUltraThinkSessions(); // Refresh session list
                }
              } else if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e) {
              // Not JSON or parsing error - ignore
              console.log('Non-JSON streaming data:', data.substring(0, 50));
            }
          }
        }
      }

    } catch (error) {
      console.error('UltraThink streaming error:', error);
      // Update the assistant message with error
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, content: `Sorry, I encountered an error: ${error.message}. Please try again.` }
          : msg
      ));
    }
    setLoading(false);
  };

  const startNewSession = () => {
    setMessages([]);
    setActiveSessionId(null);
    setMemoryContext([]);
    setContextUsed(0);
  };

  const syncUserProfile = async () => {
    setInitializing(true);
    try {
      const response = await fetch('/api/mem0/profile/sync', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ communityId })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Profile synced:', result);
        loadMemoryInsights(); // Refresh insights
      }
    } catch (error) {
      console.error('Profile sync error:', error);
    }
    setInitializing(false);
  };

  return (
    <div className="h-full flex flex-col relative bg-gray-900">
      {/* Mobile Menu Overlay */}
      {showMobileMenu && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setShowMobileMenu(false)}
        />
      )}

      {/* Sliding Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-80 bg-gray-800 shadow-xl transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 lg:w-80 lg:shadow-none lg:border-r border-gray-700 ${showMobileMenu ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        {/* Mobile Menu Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 lg:hidden">
          <h2 className="text-lg font-semibold text-gray-100">Chat History</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMobileMenu(false)}
            className="p-1 text-gray-300 hover:text-gray-100 hover:bg-gray-700"
          >
            <X size={20} />
          </Button>
        </div>

        <div className="flex flex-col h-full space-y-4 p-4">
          {/* New Chat Button */}
          <Button
            onClick={startNewSession}
            className="w-full justify-start gap-2 h-10 bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600 hover:text-white"
            variant="outline"
          >
            <Plus size={16} />
            New Chat
          </Button>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto space-y-2">
            {loadingSessions ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 p-3">
                <Loader2 size={16} className="animate-spin" />
                Loading...
              </div>
            ) : sessions.length > 0 ? (
              sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => {
                    loadSessionHistory(session.id);
                    setShowMobileMenu(false); // Close mobile menu on selection
                  }}
                  className={`w-full text-left p-3 rounded-lg text-sm transition-colors ${
                    activeSessionId === session.id
                      ? 'bg-purple-600/20 border border-purple-400/30 text-gray-100'
                      : 'hover:bg-gray-700 text-gray-300 hover:text-gray-100'
                  }`}
                >
                  <div className="font-medium truncate">
                    {session.title || 'New Chat'}
                  </div>
                  {session.last_message_at && (
                    <div className="text-gray-400 text-xs mt-1">
                      {new Date(session.last_message_at).toLocaleDateString()}
                    </div>
                  )}
                </button>
              ))
            ) : (
              <div className="text-center text-gray-400 text-sm py-8">
                No conversations yet
              </div>
            )}
          </div>

          {/* Memory Status */}
          <div className="border-t border-gray-700 pt-4 space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Brain size={16} className="text-purple-400" />
              <span className="font-medium text-gray-200">UltraThink Memory</span>
              {memoryInsights && (
                <Badge variant="secondary" className="text-xs">
                  {memoryInsights.totalMemories || 0}
                </Badge>
              )}
            </div>

            {!memoryInsights ? (
              <Button
                size="sm"
                onClick={syncUserProfile}
                disabled={initializing}
                className="w-full"
                variant="outline"
              >
                {initializing ? (
                  <Loader2 size={14} className="animate-spin mr-2" />
                ) : (
                  <Zap size={14} className="mr-2" />
                )}
                Initialize Memory
              </Button>
            ) : (
              <Button
                size="sm"
                variant="ghost"
                onClick={syncUserProfile}
                disabled={initializing}
                className="w-full text-xs"
              >
                {initializing ? (
                  <Loader2 size={12} className="animate-spin mr-1" />
                ) : (
                  <Settings size={12} className="mr-1" />
                )}
                Sync Profile
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-900">
        {/* Mobile Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700 lg:hidden bg-gray-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowMobileMenu(true)}
            className="p-2 text-gray-300 hover:text-gray-100 hover:bg-gray-700"
          >
            <Menu size={20} />
          </Button>
          <div className="flex items-center gap-2">
            <Brain size={20} className="text-purple-400" />
            <h1 className="text-lg font-semibold text-gray-100">UltraThink</h1>
          </div>
          <div className="w-8" /> {/* Spacer for centering */}
        </div>

        {/* Chat Messages */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-900"
          onScroll={handleScroll}
        >
          {messages.length === 0 ? (
            <div className="flex items-center justify-center min-h-[300px] max-h-[60vh]">
              <div className="text-center text-gray-400 max-w-md">
                <Brain size={48} className="mx-auto mb-4 text-purple-400" />
                <h3 className="text-lg font-medium mb-2 text-gray-200">Welcome to UltraThink</h3>
                <p className="text-sm mb-4">
                  Your intelligent cooking assistant with perfect memory of your preferences,
                  dietary restrictions, and cooking history.
                </p>
                <div className="space-y-2 text-xs text-left">
                  <div>• Ask about recipes from any creator</div>
                  <div>• Get personalized modifications based on your dietary needs</div>
                  <div>• Receive suggestions that learn from your feedback</div>
                  <div>• Explore cultural cuisines that match your taste</div>
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user'
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-800 text-gray-100 border border-gray-700'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div className="prose prose-sm max-w-none prose-headings:text-gray-200 prose-h1:text-base prose-h1:font-semibold prose-h1:mb-3 prose-h2:text-sm prose-h2:font-medium prose-h2:mb-2 prose-h2:mt-4 prose-ul:list-disc prose-ul:ml-4 prose-ul:my-2 prose-ol:list-decimal prose-ol:ml-4 prose-ol:my-2 prose-li:my-1 prose-li:leading-relaxed prose-strong:font-semibold prose-p:text-gray-300 prose-li:text-gray-300">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="text-sm">{msg.content}</div>
                  )}
                </div>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>

        {/* Floating Scroll to Bottom Button */}
        {!shouldAutoScroll && messages.length > 0 && (
          <div className="absolute bottom-20 right-4">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setShouldAutoScroll(true);
                scrollToBottom();
              }}
              className="h-10 w-10 rounded-full shadow-lg"
            >
              <ChevronDown size={16} />
            </Button>
          </div>
        )}

        {/* Memory Context Display */}
        {memoryContext.length > 0 && (
          <div className="mx-4 mb-4 p-3 bg-gradient-to-r from-purple-900/20 to-blue-900/20 rounded-xl border border-purple-600/30 shadow-sm">
            <div className="text-sm font-medium mb-2 flex items-center gap-2">
              <Brain size={14} className="text-purple-400" />
              <span className="text-purple-300">Memory Context ({memoryContext.length})</span>
            </div>
            <div className="space-y-2 max-h-24 overflow-y-auto">
              {memoryContext.slice(0, 2).map((memory, idx) => (
                <div key={idx} className="text-xs text-gray-300 bg-gray-800/50 p-2 rounded border border-gray-600">
                  {memory.content.length > 80
                    ? `${memory.content.slice(0, 80)}...`
                    : memory.content
                  }
                </div>
              ))}
              {memoryContext.length > 2 && (
                <div className="text-xs text-purple-400 text-center">
                  +{memoryContext.length - 2} more memories
                </div>
              )}
            </div>
          </div>
        )}

        {/* Input Area */}
        <div className="border-t border-gray-700 bg-gray-800 p-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendUltraThinkMessage()}
              placeholder="Ask UltraThink about recipes, cooking, or dietary needs..."
              className="flex-1 rounded-full border border-gray-400 bg-white px-4 py-3 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50"
              disabled={loading}
            />
            <Button
              onClick={sendUltraThinkMessage}
              disabled={loading || !inputValue.trim()}
              className="rounded-full h-12 w-12 p-0 shrink-0"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}