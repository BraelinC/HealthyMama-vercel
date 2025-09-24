import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

type ProfileResp = {
  profile_name?: string;
  primary_goal?: string | null;
  goals?: string[] | null;
  preferences?: string[] | null;
  members?: Array<{ dietaryRestrictions?: string[]; preferences?: string[] }>;
};

type WeightBasedProfile = {
  dietaryRestrictions?: string[];
  goalWeights?: Record<string, number>;
  profileName?: string;
};

function dedupe(a: string[] = []) {
  const s = new Set(a.map((x) => (x || "").trim()).filter(Boolean));
  return Array.from(s);
}

type UsedContext = { profileSummary?: { dietaryRestrictions?: string[]; goals?: string[] } } | null | undefined;

export default function UserContextCard({ usedContext }: { usedContext?: UsedContext }) {
  const query = useQuery<ProfileResp>({ queryKey: ["/api/profile"], queryFn: () => apiRequest("/api/profile") });
  const wbQuery = useQuery<WeightBasedProfile>({
    queryKey: ["/api/profile/weight-based"],
    queryFn: () => apiRequest("/api/profile/weight-based"),
  });
  const loading = query.isLoading || query.isFetching;
  const error = query.isError ? (query.error as any)?.message || "Failed to load" : null;
  const p = query.data as ProfileResp | undefined;
  const wb = wbQuery.data as WeightBasedProfile | undefined;

  const { restrictions, goals } = useMemo(() => {
    // If server already told us what it used, prefer that
    const ucDR = usedContext?.profileSummary?.dietaryRestrictions || [];
    const ucGoals = usedContext?.profileSummary?.goals || [];
    if (ucDR.length || ucGoals.length) {
      return { restrictions: dedupe(ucDR).slice(0, 8), goals: dedupe(ucGoals).slice(0, 8) };
    }

    // Prefer weight-based explicit restrictions if available
    if (Array.isArray(wb?.dietaryRestrictions) && wb!.dietaryRestrictions!.length) {
      const gWB = usedContext?.profileSummary?.goals || []; // server-provided goals still preferred if present
      return {
        restrictions: dedupe(wb!.dietaryRestrictions!).slice(0, 8),
        goals: dedupe(gWB.length ? gWB : []).slice(0, 8),
      };
    }

    const memberDR = Array.isArray(p?.members)
      ? p!.members!.flatMap((m) => (Array.isArray(m.dietaryRestrictions) ? m.dietaryRestrictions : []))
      : [];
    const prefDR = Array.isArray(p?.preferences)
      ? p!.preferences!.filter((s) => {
          const t = String(s || "").toLowerCase();
          return (
            t.includes("allerg") ||
            t.includes("intoleran") ||
            t.includes("free") ||
            t.includes("vegan") ||
            t.includes("vegetarian") ||
            t.includes("keto") ||
            t.includes("paleo") ||
            t.includes("kosher") ||
            t.includes("halal") ||
            t.includes("diet")
          );
        })
      : [];
    const r = dedupe([...memberDR, ...prefDR]).slice(0, 8);

    const goalSet = new Set<string>();
    if (Array.isArray(p?.goals)) {
      (p!.goals as any[]).forEach((goal) => {
        const str = String(goal || "").trim();
        if (!str || str.includes(":")) return;
        if (str.toLowerCase() === 'weight-based planning') return;
        goalSet.add(str);
      });
    }
    const primaryGoalStr = String(p?.primary_goal || "").trim();
    if (primaryGoalStr && primaryGoalStr.toLowerCase() !== 'weight-based planning') {
      goalSet.add(primaryGoalStr);
    }

    return { restrictions: r, goals: dedupe(Array.from(goalSet)).slice(0, 8) };
  }, [p, wb, usedContext]);

  return (
    <div className="border border-gray-700 rounded-lg p-3 bg-gray-800">
      <div className="text-sm font-medium text-gray-200 mb-2">User Context Used</div>
      {loading && <div className="text-xs text-gray-400">Loading…</div>}
      {error && <div className="text-xs text-red-400">{error}</div>}
      {!loading && !error && (
        <div className="space-y-2">
          <div>
            <div className="text-xs text-gray-400 mb-1">Dietary Restrictions (mandatory)</div>
            <div className="flex flex-wrap gap-1">
              {restrictions.length ? (
                restrictions.map((r) => (
                  <span
                    key={r}
                    className="text-xs px-2 py-0.5 rounded-full bg-purple-700/40 text-purple-200 border border-purple-600/40"
                  >
                    {r}
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-500">None set</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Goals</div>
            <div className="flex flex-wrap gap-1">
              {goals.length ? (
                goals.map((g) => (
                  <span key={g} className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-100 border border-gray-600">
                    {g}
                  </span>
                ))
              ) : (
                <span className="text-xs text-gray-500">None set</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
