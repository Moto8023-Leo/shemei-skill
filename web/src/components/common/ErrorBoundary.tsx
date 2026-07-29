import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  error: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: '' };

  static getDerivedStateFromError(err: Error): State {
    return { hasError: true, error: err.message || String(err) };
  }

  componentDidCatch(err: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', err, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif',
          background: '#f5f7fb', color: '#1d2433', padding: 32, textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, margin: '0 0 8px' }}>页面加载失败</h1>
          <p style={{ color: '#6f7788', maxWidth: 420, margin: '0 0 24px', lineHeight: 1.6 }}>
            {this.state.error || '发生了未知错误，请刷新页面重试。'}
          </p>
          <button
            style={{
              padding: '10px 24px', background: '#246bfd', color: '#fff',
              border: 'none', borderRadius: 8, fontSize: 15, cursor: 'pointer',
            }}
            onClick={() => { this.setState({ hasError: false, error: '' }); window.location.reload(); }}
          >
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
