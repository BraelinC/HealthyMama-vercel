// Lightweight Vite HMR connection debugger for local dev
// Logs lifecycle events and basic network state to help diagnose stale UI

declare global {
  interface Window {
    __VITE_HMR_DEBUG?: boolean;
  }
}

try {
  if (!window.__VITE_HMR_DEBUG) {
    window.__VITE_HMR_DEBUG = true;

    const log = (...args: any[]) => console.log("[VITE HMR]", ...args);
    const warn = (...args: any[]) => console.warn("[VITE HMR]", ...args);

    log("Boot", {
      href: location.href,
      mode: (import.meta as any).env?.MODE,
      dev: (import.meta as any).env?.DEV,
    });

    if (import.meta.hot) {
      import.meta.hot.on("vite:beforeUpdate", (payload) => {
        log("beforeUpdate", payload?.updates?.map((u: any) => u.path));
      });
      import.meta.hot.on("vite:afterUpdate", (payload) => {
        log("afterUpdate", payload?.updates?.map((u: any) => u.path));
      });
      import.meta.hot.on("vite:invalidate", (payload) => {
        warn("invalidate", payload?.path);
      });
      import.meta.hot.on("vite:error", (err) => {
        warn("error", err?.err?.message || err);
      });
      import.meta.hot.on("vite:ws", (msg) => {
        // connection, reconnect, message types
        log("ws", msg?.type || msg);
      });
    } else {
      warn("HMR disabled (no import.meta.hot). Are you in production build?");
    }

    // Basic connectivity hints
    window.addEventListener("online", () => log("navigator online"));
    window.addEventListener("offline", () => warn("navigator offline"));
    document.addEventListener("visibilitychange", () => {
      log("visibility", document.visibilityState);
    });

    // Optional: tiny ping to dev server to reveal network issues
    const ping = async () => {
      try {
        const res = await fetch("/", { cache: "no-store" });
        log("ping / status", res.status);
      } catch (e) {
        warn("ping failed", (e as any)?.message || e);
      }
    };
    setTimeout(ping, 500);
  }
} catch (e) {
  console.warn("[VITE HMR] debug init failed", e);
}

