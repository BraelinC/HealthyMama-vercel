import React from 'react';

type ErrorBoundaryState = { hasError: boolean; error?: any };

export default class ErrorBoundary extends React.Component<React.PropsWithChildren<{}>, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren<{}>) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    try { console.error('[ErrorBoundary] Caught error:', error, errorInfo); } catch {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white p-6">
          <div className="max-w-md w-full text-center">
            <h1 className="text-xl font-semibold mb-2">Something went wrong</h1>
            <p className="text-gray-400 mb-4">An unexpected error occurred. You can try reloading the page.</p>
            <button
              onClick={() => (window.location.href = window.location.href)}
              className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700"
            >
              Reload
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

