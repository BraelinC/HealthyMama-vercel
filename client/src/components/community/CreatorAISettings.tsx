import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

export default function CreatorAISettings({ communityId }: { communityId: number }) {
  const [systemPrompt, setSystemPrompt] = useState("You are a helpful assistant.");
  const [model, setModel] = useState("gpt-4o-mini");
  const [temperature, setTemperature] = useState(7);
  const [maxTokens, setMaxTokens] = useState(800);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const headers = useMemo(() => {
    const token = localStorage.getItem("auth_token");
    return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } as Record<string, string>;
  }, []);

  // Load current settings from the server
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/communities/${communityId}/ai-config`, { headers });
        if (!res.ok) return; // keep defaults if missing
        const data = await res.json();
        const cfg = data?.config;
        if (!cfg || cancelled) return;
        if (typeof cfg.system_prompt === "string") setSystemPrompt(cfg.system_prompt);
        if (typeof cfg.model === "string") setModel(cfg.model);
        if (typeof cfg.temperature === "number") setTemperature(cfg.temperature);
        if (typeof cfg.max_tokens === "number") setMaxTokens(cfg.max_tokens);
      } catch {
        // ignore load errors
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [communityId, headers]);

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/communities/${communityId}/ai-config`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          system_prompt: systemPrompt,
          model,
          // Do not send temperature/top_p when GPT-5 is selected
          ...(model.toLowerCase().startsWith("gpt-5") ? {} : { temperature }),
          max_tokens: maxTokens,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        let msg = `Error ${res.status}`;
        try {
          const j = JSON.parse(text);
          msg = j.message || msg;
        } catch {
          if (text) msg = text;
        }
        throw new Error(msg);
      }
      setStatus("Saved");
    } catch (e: any) {
      setStatus(e.message || "Failed");
    } finally {
      setSaving(false);
      setTimeout(() => setStatus(null), 2000);
    }
  }

  return (
    <div className="space-y-3 bg-gray-800 border border-gray-700 rounded-lg p-3">
      <div>
        <label className="text-sm text-gray-300">System Prompt</label>
        <textarea
          className="mt-1 w-full h-32 bg-gray-700 text-gray-100 border border-gray-600 rounded p-2"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="text-sm text-gray-300">Model</label>
          <select className="mt-1 w-full bg-gray-700 text-gray-100 border border-gray-600 rounded p-2" value={model} onChange={(e) => setModel(e.target.value)}>
            <optgroup label="GPT-5 Models (Reasoning)">
              <option value="gpt-5">gpt-5 (Full)</option>
              <option value="gpt-5-mini">gpt-5-mini (Recommended)</option>
              <option value="gpt-5-nano">gpt-5-nano (Fast)</option>
              <option value="gpt-5-chat-latest">gpt-5-chat-latest (Non-reasoning)</option>
            </optgroup>
            <optgroup label="GPT-4 Models">
              <option value="gpt-4o">gpt-4o</option>
              <option value="gpt-4o-mini">gpt-4o-mini</option>
              <option value="gpt-4-turbo">gpt-4-turbo</option>
            </optgroup>
          </select>
          {model.toLowerCase().startsWith("gpt-5") && (
            <p className="text-xs text-gray-400 mt-1">
              GPT-5 models may require API access registration
            </p>
          )}
        </div>
        <div>
          <label className="text-sm text-gray-300">Temperature (0-10)</label>
          <input
            className="mt-1 w-full bg-gray-700 text-gray-100 border border-gray-600 rounded p-2"
            type="number"
            min={0}
            max={10}
            value={temperature}
            onChange={(e) => setTemperature(parseInt(e.target.value || "0", 10))}
            disabled={model.toLowerCase().startsWith("gpt-5")}
          />
        </div>
        <div>
          <label className="text-sm text-gray-300">Max Tokens</label>
          <input className="mt-1 w-full bg-gray-700 text-gray-100 border border-gray-600 rounded p-2" type="number" min={100} max={4000} value={maxTokens} onChange={(e) => setMaxTokens(parseInt(e.target.value || "800", 10))} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={save} disabled={saving} className="px-3 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Settings"}
        </button>
        {status && <span className="text-sm text-gray-300">{status}</span>}
      </div>
    </div>
  );
}




