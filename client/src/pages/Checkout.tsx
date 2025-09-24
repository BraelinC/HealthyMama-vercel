import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowLeft, Mail } from "lucide-react";

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';
const stripePromise = STRIPE_PUBLISHABLE_KEY ? loadStripe(STRIPE_PUBLISHABLE_KEY) : null;

interface CheckoutFormProps {
  paymentType: 'founders' | 'trial' | 'monthly';
  onSuccess: () => void;
  onCancel: () => void;
}

const CheckoutForm = ({ paymentType, onSuccess, onCancel }: CheckoutFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!stripe || !elements) {
      console.error('Stripe or Elements not loaded');
      toast({
        title: "Error",
        description: "Payment system not initialized. Please refresh and try again.",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    console.log('Processing payment...');

    try {
      // For monthly and trial, we're using SetupIntent
      // For founders, we're using PaymentIntent
      if (paymentType === 'monthly' || paymentType === 'trial') {
        const { error } = await stripe.confirmSetup({
          elements,
          confirmParams: {
            return_url: window.location.origin + '/dashboard?subscription=' + paymentType,
          },
        });

        if (error) {
          toast({
            title: "Setup Failed",
            description: error.message,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Setup Successful",
            description: paymentType === 'monthly'
              ? "Your monthly subscription is being activated!"
              : "Your 30-day free trial is now active!",
          });
          onSuccess();
        }
      } else {
        // Founders payment (one-time payment)
        const { error } = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url: window.location.origin + '/dashboard',
          },
        });

        if (error) {
          toast({
            title: "Payment Failed",
            description: error.message,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Payment Successful",
            description: "Welcome to Healthy Mama Founders! You now have lifetime access.",
          });
          onSuccess();
        }
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1"
          disabled={isProcessing}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <Button 
          type="submit" 
          className="flex-1 bg-purple-600 hover:bg-purple-700"
          disabled={!stripe || isProcessing}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            paymentType === 'founders' ? 'Complete Payment ($100)' : 
            paymentType === 'monthly' ? 'Start Monthly Subscription ($20/mo)' :
            'Start 30-Day Free Trial'
          )}
        </Button>
      </div>
    </form>
  );
};

interface CheckoutProps {
  paymentType: 'founders' | 'trial' | 'monthly';
  onSuccess: () => void;
  onCancel: () => void;
}

export default function Checkout({ paymentType, onSuccess, onCancel }: CheckoutProps) {
  const [clientSecret, setClientSecret] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const createPaymentIntent = async () => {
      try {
        setIsLoading(true);
        console.log('Creating payment intent for:', paymentType);
        
        if (paymentType === 'founders') {
          // Create payment intent for $100 founders offer
          const data = await apiRequest("/api/create-payment-intent", {
            method: 'POST',
            body: JSON.stringify({
              paymentType: 'founders',
              amount: 100
            })
          });
          console.log('Payment intent created:', data);
          
          if (!data.clientSecret) {
            throw new Error('No client secret received from server');
          }
          setClientSecret(data.clientSecret);
        } else if (paymentType === 'monthly') {
          // For monthly subscription, we need to collect payment method first
          // Using SetupIntent for initial card collection
          const data = await apiRequest("/api/create-setup-intent", {
            method: 'POST',
            body: JSON.stringify({
              paymentType: 'monthly'
            })
          });
          console.log('Monthly subscription setup intent created:', data);
          
          if (!data.clientSecret) {
            throw new Error('No client secret received from server');
          }
          setClientSecret(data.clientSecret);
        } else {
          // Create setup intent for 30-day free trial
          const data = await apiRequest("/api/create-setup-intent", {
            method: 'POST',
            body: JSON.stringify({
              paymentType: 'trial'
            })
          });
          console.log('Trial setup intent created:', data);
          
          if (!data.clientSecret) {
            throw new Error('No client secret received from server');
          }
          setClientSecret(data.clientSecret);
        }
      } catch (error: any) {
        console.error('Payment initialization error:', error);
        toast({
          title: "Error",
          description: error.message || "Failed to initialize payment. Please try again.",
          variant: "destructive",
        });
        onCancel();
      } finally {
        setIsLoading(false);
      }
    };

    createPaymentIntent();
  }, [paymentType, onCancel, toast]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-emerald-50">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Setting up your payment...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-emerald-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">
            {paymentType === 'founders' ? 'Complete Your Founders Purchase' : 
             paymentType === 'monthly' ? 'Start Your Monthly Subscription' :
             'Start Your 30-Day Free Trial'}
          </CardTitle>
          <div className="text-center">
            {paymentType === 'founders' ? (
              <div>
                <div className="text-2xl font-bold text-purple-600">$100</div>
                <div className="text-sm text-gray-600">One-time payment for lifetime access</div>
              </div>
            ) : paymentType === 'monthly' ? (
              <div>
                <div className="text-2xl font-bold text-blue-600">$20/month</div>
                <div className="text-sm text-gray-600">Monthly subscription, cancel anytime</div>
              </div>
            ) : (
              <div>
                <div className="text-2xl font-bold text-emerald-600">$0 Today</div>
                <div className="text-sm text-gray-600">30-day free trial, then $20/month</div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {clientSecret && stripePromise ? (
            <Elements stripe={stripePromise} options={{ clientSecret }}>
              <CheckoutForm 
                paymentType={paymentType} 
                onSuccess={onSuccess} 
                onCancel={onCancel} 
              />
            </Elements>
          ) : (
            <div className="text-center p-4">
              <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-600">{STRIPE_PUBLISHABLE_KEY ? 'Initializing payment...' : 'Stripe publishable key missing. Set VITE_STRIPE_PUBLISHABLE_KEY and restart.'}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}