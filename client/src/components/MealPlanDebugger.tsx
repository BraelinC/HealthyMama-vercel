import { useState } from "react";
import { Button } from "@/components/ui/button";
import { queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Bug, Database, Upload, Download } from "lucide-react";

export function MealPlanDebugger() {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const runDiagnostics = async () => {
    setIsLoading(true);
    const results: any = {
      timestamp: new Date().toISOString(),
      browser: navigator.userAgent,
      localStorage: {},
      apiTests: {}
    };

    try {
      // Check localStorage
      results.localStorage = {
        authToken: !!localStorage.getItem('auth_token'),
        tokenLength: localStorage.getItem('auth_token')?.length || 0,
        otherKeys: Object.keys(localStorage)
      };

      // Test authentication
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          const userResponse = await fetch('/api/auth/user', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          results.apiTests.authCheck = {
            status: userResponse.status,
            ok: userResponse.ok,
            user: userResponse.ok ? await userResponse.json() : null
          };
        } catch (error) {
          results.apiTests.authCheck = { error: (error as Error).message };
        }

        // Test saved meal plans fetch
        try {
          const savedPlansResponse = await fetch('/api/meal-plans/saved', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const savedPlansData = savedPlansResponse.ok ? await savedPlansResponse.json() : null;
          results.apiTests.savedPlans = {
            status: savedPlansResponse.status,
            ok: savedPlansResponse.ok,
            count: savedPlansData?.length || 0,
            plans: savedPlansData?.map((p: any) => ({
              id: p.id,
              name: p.name,
              createdAt: p.createdAt,
              hasMealPlan: !!(p.meal_plan || p.mealPlan) // Check both fields for compatibility
            })) || []
          };
        } catch (error) {
          results.apiTests.savedPlans = { error: (error as Error).message };
        }

        // Test saving a minimal meal plan
        const testPlan = {
          name: `Debug Test ${Date.now()}`,
          description: 'Test plan for debugging',
          meal_plan: {
            day_1: {
              breakfast: {
                title: 'Test Breakfast',
                cook_time_minutes: 10,
                difficulty: 1,
                ingredients: ['test ingredient']
              }
            }
          }
        };

        try {
          const saveResponse = await fetch('/api/meal-plans', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(testPlan)
          });
          
          results.apiTests.saveTest = {
            status: saveResponse.status,
            ok: saveResponse.ok,
            data: saveResponse.ok ? await saveResponse.json() : await saveResponse.text()
          };
        } catch (error) {
          results.apiTests.saveTest = { error: (error as Error).message };
        }
      } else {
        results.apiTests.authCheck = { error: 'No auth token found' };
      }

      setDebugInfo(results);
      
      toast({
        title: "Diagnostics Complete",
        description: `Found ${results.apiTests.savedPlans?.count || 0} saved plans`,
      });

    } catch (error) {
      results.globalError = (error as Error).message;
      setDebugInfo(results);
      
      toast({
        title: "Diagnostics Failed",
        description: (error as Error).message,
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearAllSavedPlans = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;

    try {
      const savedPlansResponse = await fetch('/api/meal-plans/saved', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (savedPlansResponse.ok) {
        const plans = await savedPlansResponse.json();
        
        for (const plan of plans) {
          await fetch(`/api/meal-plans/${plan.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
        }
        
        toast({
          title: "Success",
          description: `Deleted ${plans.length} saved plans`,
        });
        
        // Re-run diagnostics
        runDiagnostics();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clear saved plans",
        variant: "destructive"
      });
    }
  };

  const refreshQueryCache = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/meal-plans/saved'] });
    toast({
      title: "Cache Refreshed",
      description: "React Query cache has been invalidated and will refetch data",
    });
  };

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bug className="h-5 w-5" />
          Meal Plan Debug Console
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={runDiagnostics}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Database className="h-4 w-4" />
            {isLoading ? 'Running...' : 'Run Diagnostics'}
          </Button>
          
          <Button 
            onClick={clearAllSavedPlans}
            variant="destructive"
            className="flex items-center gap-2"
          >
            <Upload className="h-4 w-4" />
            Clear All Saved Plans
          </Button>
          
          <Button 
            onClick={refreshQueryCache}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            Refresh Cache
          </Button>
        </div>

        {debugInfo && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Authentication</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant={debugInfo.localStorage.authToken ? "default" : "destructive"}>
                    {debugInfo.localStorage.authToken ? "Token Present" : "No Token"}
                  </Badge>
                  {debugInfo.apiTests.authCheck?.user && (
                    <p className="text-xs mt-1">
                      User ID: {debugInfo.apiTests.authCheck.user.id}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Saved Plans</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant={debugInfo.apiTests.savedPlans?.count > 0 ? "default" : "secondary"}>
                    {debugInfo.apiTests.savedPlans?.count || 0} Plans
                  </Badge>
                  <p className="text-xs mt-1">
                    Status: {debugInfo.apiTests.savedPlans?.status || 'Unknown'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Save Test</CardTitle>
                </CardHeader>
                <CardContent>
                  <Badge variant={debugInfo.apiTests.saveTest?.ok ? "default" : "destructive"}>
                    {debugInfo.apiTests.saveTest?.ok ? "Success" : "Failed"}
                  </Badge>
                  <p className="text-xs mt-1">
                    Status: {debugInfo.apiTests.saveTest?.status || 'Unknown'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {debugInfo.apiTests.savedPlans?.plans?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Found Plans</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {debugInfo.apiTests.savedPlans.plans.map((plan: any) => (
                      <div key={plan.id} className="text-xs border rounded p-2">
                        <strong>{plan.name}</strong> (ID: {plan.id})
                        <br />
                        Created: {new Date(plan.createdAt).toLocaleString()}
                        <br />
                        Has Meal Plan: {plan.hasMealPlan ? 'Yes' : 'No'}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Raw Debug Data</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={JSON.stringify(debugInfo, null, 2)}
                  readOnly
                  className="font-mono text-xs h-64"
                />
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default MealPlanDebugger;