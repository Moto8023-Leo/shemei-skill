/**
 * Workbench — new Creative Brief workflow (Phase 1).
 *
 * Replaces the old 3-column dashboard of ParameterPanel + WorkspacePanel + RightRail
 * with the IdeaComposer → BriefPanel → StreamlinedParameterPanel → ContentResults pipeline.
 */
import { useBriefStore } from '../store/useBriefStore';
import WorkflowStepper from './workbench/WorkflowStepper';
import IdeaComposer from './workbench/IdeaComposer';
import BriefPanel from './workbench/BriefPanel';
import StreamlinedParameterPanel from './workbench/StreamlinedParameterPanel';
import GenerationSkeleton from './workbench/GenerationSkeleton';
import ContentResults from './workbench/ContentResults';
import RightRail from './workbench/RightRail';

// ── ErrorBoundary to catch any rendering crash ──
import { Component, type ReactNode } from 'react';
class WorkbenchErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  state = { hasError: false, error: '' };
  static getDerivedStateFromError(e: Error) { return { hasError: true, error: e.message }; }
  render() {
    if (this.state.hasError) {
      return (
        <section className="workspace-panel empty-workspace" style={{ minHeight: 300, gridColumn: '1 / -1' }}>
          <div className="empty-illustration" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>!</div>
          <h2>界面渲染异常</h2>
          <p>{this.state.error}</p>
          <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => { this.setState({ hasError: false, error: '' }); window.location.reload(); }}>
            刷新页面
          </button>
        </section>
      );
    }
    return <>{this.props.children}</>;
  }
}

function EmptyWorkspace() {
  const briefApplied = useBriefStore((s) => s.briefApplied);
  return (
    <section className="workspace-panel empty-workspace">
      <div className="empty-illustration">✦</div>
      <h2>{briefApplied ? '准备好生成内容' : '描述你的推广想法'}</h2>
      <p>
        {briefApplied
          ? '参数已从 Creative Brief 自动填充。点击"✦ 开始生成"，AI 将生成社媒文案和图片 Prompt。'
          : '在左侧输入框中用自然语言描述你的推广计划，AI 会先理解你的创意，再确认 Brief 后生成内容。'}
      </p>
    </section>
  );
}

export default function Workbench() {
  const briefVisible = useBriefStore((s) => s.briefVisible);
  const briefApplied = useBriefStore((s) => s.briefApplied);
  const generationStatus = useBriefStore((s) => s.generationStatus);
  const generatedData = useBriefStore((s) => s.generatedData);
  const errorMessage = useBriefStore((s) => s.errorMessage);

  return (
    <WorkbenchErrorBoundary>
      <WorkflowStepper />
      {errorMessage && (
        <div className="warning-box" style={{ margin: '0 0 8px 0', padding: '10px 14px', borderRadius: 9, fontSize: 11 }}>
          {errorMessage}
        </div>
      )}
      <div className="dashboard-grid">
        {/* Left Column: Idea → Brief → Params */}
        <div style={{ display: 'grid', gap: 12, alignSelf: 'start' }}>
          <IdeaComposer />
          {briefVisible && !briefApplied && <BriefPanel />}
          {briefApplied && <StreamlinedParameterPanel />}
        </div>

        {/* Center Column: Empty / Generating / Error / Results */}
        <div style={{ minWidth: 0 }}>
          {errorMessage && generationStatus === 'error' && (
            <section className="workspace-panel empty-workspace">
              <div className="empty-illustration" style={{ background: 'var(--amber-soft)', color: 'var(--amber)' }}>!</div>
              <h2>生成失败</h2>
              <p>{errorMessage}。请检查后端服务是否正常运行，然后重试。</p>
            </section>
          )}
          {!errorMessage && generationStatus === 'idle' && <EmptyWorkspace />}
          {generationStatus === 'loading' && <GenerationSkeleton />}
          {generationStatus === 'done' && generatedData && <ContentResults />}
        </div>

        {/* Right Column */}
        <RightRail />
      </div>
    </WorkbenchErrorBoundary>
  );
}
