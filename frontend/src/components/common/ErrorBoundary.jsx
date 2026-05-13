import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6"
          style={{ background: 'var(--bg-primary)' }}>
          <div className="glass rounded-2xl p-8 max-w-md w-full text-center animate-fade-in">
            <div className="text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-cinzel gradient-text mb-2">Something went wrong</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
              Don't worry, your shayari is safe. Please try refreshing.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                className="btn-ghost py-2.5 px-5 text-sm"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="btn-primary py-2.5 px-5 text-sm"
              >
                Refresh Page
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="text-xs cursor-pointer" style={{ color: 'var(--text-muted)' }}>
                  Error details (dev only)
                </summary>
                <pre className="text-xs mt-2 p-3 rounded-lg overflow-auto"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171' }}>
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
