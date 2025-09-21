import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { buildApiUrl } from "../config/api";

// Centralized API request function with robust error handling and auto token refresh
export async function apiRequest(
  url: string,
  options: RequestInit = {}
): Promise<any> {
  let token = localStorage.getItem('auth_token');
  
  // Clear malformed tokens
  if (token && (token === 'null' || token.length < 10)) {
    console.log('🔧 Clearing malformed token:', token);
    localStorage.removeItem('auth_token');
    token = null;
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Build full URL if it's a relative path
  const fullUrl = url.startsWith('http') ? url : buildApiUrl(url);
  
  // console.log('API Request:', { url: fullUrl, method: options.method || 'GET', hasBody: !!options.body });

  try {
    const res = await fetch(fullUrl, {
      credentials: "include",
      ...options,
      headers,
    });

    // Check for auto-refreshed token in response header
    const newToken = res.headers.get('X-New-Token');
    if (newToken) {
      console.log('🔄 Received refreshed token from server, updating localStorage');
      localStorage.setItem('auth_token', newToken);
      
      // Notify the app about token refresh
      window.dispatchEvent(new CustomEvent('auth-token-refreshed', { detail: { token: newToken } }));
    }

    // console.log('API Response:', { 
    //   url: fullUrl, 
    //   status: res.status, 
    //   ok: res.ok,
    //   contentType: res.headers.get('content-type'),
    //   hasNewToken: !!newToken
    // });

    // Check if response is JSON
    const contentType = res.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await res.text();
      console.error('Non-JSON Response:', text);
      const err: any = new Error(`Server returned ${contentType || 'unknown content type'} instead of JSON. Check endpoint: ${fullUrl}`);
      (err as any).status = res.status;
      throw err;
    }

    const text = await res.text();
    // console.log('API Response Text:', text);

    if (!text || text.trim() === '') {
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return null;
    }

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      console.error('JSON parse error:', e, 'Text:', text);
      throw new Error('Invalid JSON response from server');
    }

    if (!res.ok) {
      const status = res.status;
      const errorMessage = parsed?.message || parsed?.error || `HTTP error! status: ${status}`;

      // Proactively clear invalid/expired tokens so app can recover gracefully
      const lower = String(errorMessage).toLowerCase();
      if (
        status === 401 ||
        status === 403 ||
        lower.includes('invalid token') ||
        lower.includes('access token required') ||
        lower.includes('authentication required')
      ) {
        try { localStorage.removeItem('auth_token'); } catch {}
        // Emit a lightweight event for listeners if needed
        try { window.dispatchEvent(new CustomEvent('auth-token-invalid')); } catch {}
      }

      const err: any = new Error(`${errorMessage} (${status})`);
      err.status = status;
      throw err;
    }

    // console.log('API Parsed Response:', parsed);
    return parsed;
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
}

// Safe API request function for mutations with better error handling
export async function safeApiRequest(url: string, options: RequestInit = {}) {
  return apiRequest(url, options);
}

// Safe JSON parsing that never throws
function safeJsonParse(text: string) {
  if (!text || text.trim() === '' || text === 'undefined' || text === 'null') {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    console.error('JSON parse error:', error, 'Text:', text);
    return null;
  }
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    try {
      return await apiRequest(queryKey[0] as string, { method: 'GET' });
    } catch (error: any) {
      if (unauthorizedBehavior === "returnNull" && error.message?.includes('401')) {
        return null;
      }
      throw error;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: async ({ queryKey }) => {
        const [url] = queryKey as [string];
        // console.log('Query function called for:', url);
        try {
          const result = await apiRequest(url, { method: 'GET' });
          // console.log('Query result:', result);
          return result;
        } catch (error: any) {
          const msg = String(error?.message || '').toLowerCase();
          const status = (error && (error as any).status) || 0;
          // For auth status probe, treat unauthorized as unauthenticated (null) instead of error
          if (
            (url === '/api/auth/user' || url.endsWith('/api/auth/user')) &&
            (status === 401 || status === 403 || msg.includes('invalid token') || msg.includes('access token required') || msg.includes('authentication required'))
          ) {
            return null;
          }
          console.error('Query error for', url, ':', error);
          throw error;
        }
      },
      // Disable client caching while we debug: always consider data stale
      staleTime: 0,
      cacheTime: 0,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,
      retry: (failureCount, error: any) => {
        // console.log('Query retry attempt:', failureCount, 'for error:', error);
        // Don't retry on authentication or client errors
        const msg = String(error?.message || '').toLowerCase();
        const status = (error && (error as any).status) || 0;
        if (
          msg.includes('401') || msg.includes('403') || msg.includes('invalid token') || msg.includes('access token required') ||
          status === 401 || status === 403 || msg.includes('400')
        ) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
});
