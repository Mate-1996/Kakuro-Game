'use client';

import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import AuthForm from './components/Authform';
import Dashboard from './components/Dashboard';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';

export default function Home() {
  const { user, loading, isGuest, setIsGuest } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-foreground" />
      </div>
    );
  }

  // If logged in or guest → show Dashboard
  if (user || isGuest) {
    return (
      <div className="flex min-h-screen items-start justify-center bg-background px-4 py-8">
        <Dashboard />
      </div>
    );
  }

  // If user clicked Login/Signup → show AuthForm
  if (showAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="absolute top-4 left-4">
          <Button variant="ghost" onClick={() => setShowAuth(false)} className="cursor-pointer">
            ← Back
          </Button>
        </div>
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <AuthForm />
      </div>
    );
  }

  // Landing page
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <main className="flex flex-col items-center justify-center space-y-8">
        <h1 className="text-6xl font-bold text-foreground">Kakuro</h1>
        <div className="flex flex-col items-center space-y-4">
          <div className="flex space-x-4">
            <Button
              variant="outline"
              size="lg"
              className="cursor-pointer"
              onClick={() => setIsGuest(true)}
            >
              Continue as Guest
            </Button>
            <Button
              size="lg"
              className="cursor-pointer"
              onClick={() => setShowAuth(true)}
            >
              Login / Signup
            </Button>
          </div>
          
        </div>
      </main>
    </div>
  );
}