import React from 'react';

interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
    errorInfo?: React.ErrorInfo;
}

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ComponentType<{ error?: Error; retry: () => void }>;
}

export class EditorErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
        this.retry = this.retry.bind(this);
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return {
            hasError: true,
            error
        };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('Editor Error Boundary caught an error:', error, errorInfo);
        this.setState({
            error,
            errorInfo
        });
    }

    retry() {
        this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    }

    render() {
        if (this.state.hasError) {
            const FallbackComponent = this.props.fallback || DefaultErrorFallback;
            return <FallbackComponent error={this.state.error} retry={this.retry} />;
        }

        return this.props.children;
    }
}

const DefaultErrorFallback: React.FC<{ error?: Error; retry: () => void }> = ({ error, retry }) => (
    <div className="flex flex-col items-center justify-center min-h-64 bg-gray-900 text-white rounded-lg border border-gray-700 p-8">
        <div className="text-red-400 text-6xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold mb-2">编辑器遇到错误</h2>
        <p className="text-gray-400 mb-4 text-center">
            {error?.message || '发生了未知错误'}
        </p>
        <div className="flex gap-4">
            <button 
                onClick={retry}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
            >
                重试
            </button>
            <button 
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold transition-colors"
            >
                刷新页面
            </button>
        </div>
        {process.env.NODE_ENV === 'development' && error && (
            <details className="mt-4 text-xs text-gray-500">
                <summary className="cursor-pointer">错误详情</summary>
                <pre className="mt-2 p-2 bg-gray-800 rounded overflow-auto max-w-md">
                    {error.stack}
                </pre>
            </details>
        )}
    </div>
);
