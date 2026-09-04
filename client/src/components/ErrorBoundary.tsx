import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Without this, an unexpected render error anywhere in the tree unmounts the entire React app
 * to a blank white screen (React's default behavior with no error boundary) — the single worst
 * possible failure mode for a client-facing product. This catches it and shows a recoverable
 * screen instead.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-6 text-center">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
          <div>
            <h1 className="font-display text-xl font-semibold text-gray-900">Something went wrong</h1>
            <p className="mt-1 max-w-sm text-sm text-gray-500">
              This screen hit an unexpected error. Your data is safe — try reloading, or go back to the dashboard.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => (window.location.href = "/")}>
              Go to dashboard
            </Button>
            <Button onClick={() => window.location.reload()}>Reload</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
