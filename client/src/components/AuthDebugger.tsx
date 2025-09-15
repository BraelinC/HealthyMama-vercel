import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { refreshToken, clearAuthAndReload, debugAuthToken } from "@/utils/tokenRefresh";

export function AuthDebugger() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handleRefreshToken = async () => {
    if (!email || !password) {
      setMessage("Please enter email and password");
      return;
    }

    setLoading(true);
    setMessage("Refreshing token...");
    
    const success = await refreshToken(email, password);
    
    if (success) {
      setMessage("Token refreshed! Page will reload...");
    } else {
      setMessage("Failed to refresh token. Check your credentials.");
    }
    
    setLoading(false);
  };

  const handleDebugToken = () => {
    console.clear();
    console.log("=== AUTH TOKEN DEBUG ===");
    debugAuthToken();
    setMessage("Check browser console for token details");
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Auth Token Debugger</CardTitle>
        <CardDescription>
          Fix JWT authentication issues by refreshing your token
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription>
            If you're seeing "JWT invalid signature" errors, your token was created with an old JWT secret. 
            Enter your credentials to get a new token.
          </AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Button 
            onClick={handleRefreshToken} 
            disabled={loading}
            className="w-full"
          >
            {loading ? "Refreshing..." : "Refresh Token"}
          </Button>
          
          <Button 
            onClick={handleDebugToken}
            variant="outline"
            className="w-full"
          >
            Debug Current Token
          </Button>
          
          <Button 
            onClick={clearAuthAndReload}
            variant="destructive"
            className="w-full"
          >
            Clear Token & Re-login
          </Button>
        </div>

        {message && (
          <Alert>
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}