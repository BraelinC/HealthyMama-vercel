import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Send, MessagesSquare, Plus, TestTube2 } from "lucide-react";
import CreatorAISettings from "@/components/community/CreatorAISettings";
import CookbookUploader from "@/components/community/CookbookUploader";
import UserContextCard from "@/components/community/UserContextCard";

interface CommunityChatProps {
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

export default function CommunityChat({ communityId }: CommunityChatProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ApiMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [initializing, setInitializing] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [lastUsedContext, setLastUsedContext] = useState<any>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const authHeaders = useMemo(() => {
    const token = localStorage.getItem("auth_token");
    return {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    } as Record<string, string>;
  }, []);

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function fetchSessions() {
    setLoadingSessions(true);
    try {
      const res = await fetch(`/api/communities/${communityId}/chats`, {
        headers: authHeaders,
      });
      if (!res.ok) throw new Error("Failed to load sessions");
      const data = await res.json();
      const list: Session[] = data.sessions || [];
      setSessions(list);
      if (list.length > 0 && !activeSessionId) {
        setActiveSessionId(list[0].id);
      }
    } finally {
      setLoadingSessions(false);
    }
  }

  async function ensureSession() {
    if (activeSessionId) return activeSessionId;
    setInitializing(true);
    try {
      const res = await fetch(`/api/communities/${communityId}/chats`, {
        method: "POST",
        headers: authHeaders,
      });
      if (!res.ok) throw new Error("Failed to create session");
      const data = await res.json();
      setActiveSessionId(data.sessionId);
      await fetchSessions();
      return data.sessionId as string;
    } finally {
      setInitializing(false);
    }
  }

  async function fetchHistory(sessionId: string) {
    const res = await fetch(`/api/communities/${communityId}/chats/${sessionId}/history`, {
      headers: authHeaders,
    });
    if (!res.ok) throw new Error("Failed to load history");
    const data = await res.json();
    setMessages((data.messages || []) as ApiMessage[]);
  }

  useEffect(() => {
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [communityId]);

  useEffect(() => {
    if (activeSessionId) fetchHistory(activeSessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!inputValue.trim() || loading) return;
    const sessionId = previewMode ? null : activeSessionId || (await ensureSession());
    if (!previewMode && !sessionId) return;

    const optimistic: ApiMessage = {
      id: Date.now(),
      role: "user",
      content: inputValue,
    };
    setMessages((prev) => [...prev, optimistic]);
    setInputValue("");
    setLoading(true);
    try {
      const res = previewMode
        ? await fetch(`/api/communities/${communityId}/preview`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ message: optimistic.content }),
          })
        : await fetch(`/api/communities/${communityId}/chats/${sessionId}/messages`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ message: optimistic.content }),
          });
      if (!res.ok) throw new Error("Failed to send message");
      const data = await res.json();
      // Debug: Inspect server response shape
      // eslint-disable-next-line no-console
      console.log("[AI RESPONSE DEBUG]", data);
      if (data && data.usedContext) setLastUsedContext(data.usedContext);
      const contentCandidate =
        (typeof data.response === "string" && data.response.trim()) ||
        (typeof data.output_text === "string" && data.output_text.trim()) ||
        (typeof data.message === "string" && data.message.trim()) ||
        "(No output received)";
      const assistant: ApiMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: contentCandidate,
      };
      setMessages((prev) => [...prev, assistant]);
      if (!previewMode) fetchSessions(); // refresh ordering
    } catch (err) {
      // revert optimistic if needed (optional)
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[70vh] bg-gray-900 rounded-lg border border-gray-700">
      <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-2">
          <MessagesSquare className="w-4 h-4 text-purple-400" />
          <span className="font-medium text-gray-100">AI Chat</span>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-sm text-gray-200">
            <input
              type="checkbox"
              checked={showContext}
              onChange={(e) => setShowContext(e.target.checked)}
            />
            Show Context
          </label>
          <label className="flex items-center gap-1 text-sm text-gray-200">
            <input
              type="checkbox"
              checked={previewMode}
              onChange={(e) => setPreviewMode(e.target.checked)}
            />
            <TestTube2 className="w-3 h-3" /> Creator Preview
          </label>
          <select
            className="border border-gray-600 bg-gray-700 text-gray-100 rounded px-2 py-1 text-sm"
            value={activeSessionId ?? ""}
            onChange={(e) => setActiveSessionId(e.target.value)}
            disabled={previewMode}
          >
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title || s.id.slice(0, 8)}
              </option>
            ))}
          </select>
          <button
            className="inline-flex items-center gap-1 px-2 py-1 text-sm border border-gray-600 rounded bg-gray-700 text-gray-100 hover:bg-gray-600"
            onClick={async () => {
              setActiveSessionId(null);
              setMessages([]);
              const id = await ensureSession();
              if (id) {
                setActiveSessionId(id);
              }
            }}
            disabled={initializing || previewMode}
          >
            <Plus className="w-3 h-3" /> New
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-900">
        {(showContext || previewMode) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {showContext && <UserContextCard usedContext={lastUsedContext} />}
            {previewMode && (
              <>
                <CreatorAISettings communityId={communityId} />
                <CookbookUploader communityId={communityId} />
              </>
            )}
          </div>
        )}
        {loadingSessions && (
          <div className="text-sm text-gray-400">Loading sessions…</div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-purple-600 text-white rounded-br-md"
                  : "bg-gray-800 text-gray-100 border border-gray-700 rounded-bl-md"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <form onSubmit={handleSend} className="p-3 border-t border-gray-700 bg-gray-800">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask for recipes, adaptions, meal ideas…"
            className="flex-1 border border-gray-600 bg-gray-700 text-white placeholder-gray-400 rounded-2xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-500"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || loading}
            className={`inline-flex items-center justify-center w-10 h-10 rounded-full text-white ${
              inputValue.trim() && !loading ? "bg-purple-600 hover:bg-purple-700" : "bg-gray-600"
            }`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </form>
    </div>
  );
}
