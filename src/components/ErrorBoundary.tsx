
import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "./ui/button";
import { RefreshCw, AlertTriangle } from "lucide-react";

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
        errorInfo: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error, errorInfo: null };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
        this.setState({ errorInfo });
    }

    private handleReload = () => {
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-muted p-4">
                    <div className="bg-card dark:bg-slate-900 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-red-100">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="h-8 w-8 text-red-600" />
                        </div>

                        <h1 className="text-2xl font-bold text-foreground mb-2">
                            Something went wrong
                        </h1>

                        <p className="text-muted-foreground mb-6">
                            We're sorry, but the application encountered an unexpected error.
                        </p>

                        <div className="bg-muted/50 p-4 rounded-lg text-left text-xs font-mono text-muted-foreground overflow-auto max-h-40 mb-6">
                            {this.state.error && this.state.error.toString()}
                        </div>

                        <div className="flex gap-3 justify-center">
                            <Button onClick={() => window.history.back()} variant="outline">
                                Go Back
                            </Button>
                            <Button onClick={this.handleReload} className="bg-red-600 hover:bg-red-700">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                Reload Page
                            </Button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
