import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Key, User, LogIn } from "lucide-react";

export function QuickAuthDebug() {
  const [authStatus, setAuthStatus] = useState<any>(null);
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('test12345');
  const { toast } = useToast();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setAuthStatus({ authenticated: false });
      return;
    }

    try {
      const response = await fetch('/api/auth/user', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const user = await response.json();
        setAuthStatus({ authenticated: true, user, token: token.substring(0, 20) + '...' });
      } else {
        setAuthStatus({ authenticated: false, error: `HTTP ${response.status}` });
      }
    } catch (error) {
      setAuthStatus({ authenticated: false, error: (error as Error).message });
    }
  };

  const quickRegister = async () => {
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: `${Date.now()}@example.com`, // Unique email
          password: 'test12345', // 8+ characters required
          phone: '+1234567890', // Required field
          full_name: 'Test User'
        })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('auth_token', data.token);
        toast({ title: "Success", description: "User registered and logged in!" });
        checkAuthStatus();
      } else {
        const error = await response.text();
        toast({ title: "Registration Failed", description: error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
    }
  };

  const quickLogin = async () => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('auth_token', data.token);
        toast({ title: "Success", description: "Logged in!" });
        checkAuthStatus();
      } else {
        const error = await response.text();
        toast({ title: "Login Failed", description: error, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Error", description: (error as Error).message, variant: "destructive" });
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    setAuthStatus({ authenticated: false });
    toast({ title: "Logged out", description: "Auth token removed" });
  };

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Key className="h-4 w-4" />
          Quick Auth Debug
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <Badge variant={authStatus?.authenticated ? "default" : "destructive"}>
            {authStatus?.authenticated ? "Authenticated" : "Not Authenticated"}
          </Badge>
          {authStatus?.user && (
            <span className="text-xs">ID: {authStatus.user.id}</span>
          )}
        </div>

        {authStatus?.error && (
          <p className="text-xs text-red-500">Error: {authStatus.error}</p>
        )}

        {!authStatus?.authenticated && (
          <div className="space-y-2">
            <Input
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-8 text-xs"
            />
            <Input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-8 text-xs"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={quickLogin} className="flex-1">
                <LogIn className="h-3 w-3 mr-1" />
                Login
              </Button>
              <Button size="sm" onClick={quickRegister} variant="outline" className="flex-1">
                <User className="h-3 w-3 mr-1" />
                Register
              </Button>
            </div>
          </div>
        )}

        {authStatus?.authenticated && (
          <Button size="sm" onClick={logout} variant="outline" className="w-full">
            Logout
          </Button>
        )}

        <Button size="sm" onClick={checkAuthStatus} variant="ghost" className="w-full">
          Refresh Status
        </Button>
      </CardContent>
    </Card>
  );
}

export default QuickAuthDebug;