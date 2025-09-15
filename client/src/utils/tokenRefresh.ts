// Utility to refresh JWT token when secret has changed
export async function refreshToken(email: string, password: string): Promise<boolean> {
  try {
    const response = await fetch('/api/auth/refresh-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      console.error('Token refresh failed:', await response.text());
      return false;
    }

    const data = await response.json();
    
    // Store new token
    localStorage.setItem('auth_token', data.token);
    
    console.log('✅ Token refreshed successfully!');
    console.log('User:', data.user);
    
    // Reload page to apply new token
    window.location.reload();
    
    return true;
  } catch (error) {
    console.error('Token refresh error:', error);
    return false;
  }
}

// Helper to clear old token and force re-login
export function clearAuthAndReload() {
  localStorage.removeItem('auth_token');
  window.location.href = '/login';
}

// Debug helper to check current token status
export function debugAuthToken() {
  const token = localStorage.getItem('auth_token');
  
  if (!token) {
    console.log('❌ No auth token found in localStorage');
    return;
  }
  
  // Decode token without verification (just to see contents)
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.error('❌ Invalid token format');
      return;
    }
    
    const payload = JSON.parse(atob(parts[1]));
    const header = JSON.parse(atob(parts[0]));
    
    console.log('🔍 Token Debug Info:');
    console.log('Header:', header);
    console.log('Payload:', payload);
    console.log('User ID:', payload.userId);
    console.log('Issued at:', new Date(payload.iat * 1000).toLocaleString());
    console.log('Expires at:', new Date(payload.exp * 1000).toLocaleString());
    console.log('Token age:', Math.floor((Date.now() / 1000 - payload.iat) / 3600), 'hours');
    
    // Check if expired
    if (payload.exp * 1000 < Date.now()) {
      console.error('❌ Token is expired!');
    } else {
      console.log('✅ Token is still valid');
    }
    
  } catch (error) {
    console.error('❌ Failed to decode token:', error);
  }
}