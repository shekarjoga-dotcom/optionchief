import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught component error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleClearCacheAndReload = () => {
    try {
      localStorage.removeItem('options_oracle_triggered_alerts');
      localStorage.removeItem('options_oracle_custom_strategies');
    } catch (e) {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-2xl bg-cardClr border border-red-500/30 text-center flex flex-col items-center justify-center my-6 max-w-xl mx-auto shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-extrabold text-white mb-1">
            {this.props.fallbackTitle || 'Component Encountered an Issue'}
          </h3>
          <p className="text-xs text-gray-400 mb-4 max-w-md">
            {this.state.error?.message || 'An unexpected rendering error occurred. You can retry or clear temporary local storage cache.'}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white font-bold text-xs rounded-xl transition-all border border-borderClr flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry Component</span>
            </button>
            <button
              onClick={this.handleClearCacheAndReload}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-red-600/20"
            >
              Clear Cache & Refresh
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
