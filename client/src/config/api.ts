// API Configuration
// This file handles the API URL configuration for different environments

// Detect environment
const getApiBaseUrl = () => {
  // If explicitly set via environment variable, use that
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  
  // Always use same-origin API (works for localhost and Vercel)
  return '';
};

export const API_BASE_URL = getApiBaseUrl();

// Helper function to build full API URLs
export function buildApiUrl(path: string): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}

// console.log('API Base URL configured:', API_BASE_URL);