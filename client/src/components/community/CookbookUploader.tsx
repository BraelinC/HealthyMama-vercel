import { useMemo, useState } from "react";
import { Loader2, Upload } from "lucide-react";

export default function CookbookUploader({ communityId }: { communityId: number }) {
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const headers = useMemo(() => {
    const token = localStorage.getItem("auth_token");
    return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) } as Record<string, string>;
  }, []);

  async function upload() {
    if (!title || !text) return;
    setUploading(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/communities/${communityId}/cookbook`, {
        method: "POST",
        headers,
        body: JSON.stringify({ title, content: text, tags: [] }),
      });
      if (!res.ok) throw new Error(await res.text());
      setStatus("Uploaded");
      setText("");
      setTitle("");
    } catch (e: any) {
      setStatus(e.message || "Failed");
    } finally {
      setUploading(false);
      setTimeout(() => setStatus(null), 2000);
    }
  }

  return (
    <div className="space-y-3 bg-gray-800 border border-gray-700 rounded-lg p-3">
      <div>
        <label className="text-sm text-gray-300">Title</label>
        <input className="mt-1 w-full bg-gray-700 text-gray-100 border border-gray-600 rounded p-2" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="text-sm text-gray-300">Paste Text (PDF extraction coming next)</label>
        <textarea className="mt-1 w-full h-32 bg-gray-700 text-gray-100 border border-gray-600 rounded p-2" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="flex items-center gap-2">
        <button onClick={upload} disabled={uploading || !title || !text} className="px-3 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-60 inline-flex items-center gap-2">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload
        </button>
        {status && <span className="text-sm text-gray-300">{status}</span>}
      </div>
    </div>
  );
}




