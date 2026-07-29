// CommandBar — mode hint + action buttons (Creative Brief aware)
import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useBriefStore } from '../../store/useBriefStore';
import { useNavigate } from 'react-router-dom';

interface Props {
  mode: string;
  currentPath: string;
}

export default function CommandBar({ mode }: Props) {
  const showToast = useAppStore((s) => s.showToast);
  const navigate = useNavigate();

  // New brief store (for workbench page)
  const briefStage = useBriefStore((s) => s.stage);
  const briefGenerating = useBriefStore((s) => s.analysisStatus === 'loading');
  const briefApplied = useBriefStore((s) => s.briefApplied);
  const generationLoading = useBriefStore((s) => s.generationStatus === 'loading');
  const contentReady = useBriefStore((s) => s.generationStatus === 'done');
  const analyzeIdea = useBriefStore((s) => s.analyzeIdea);
  const reanalyze = useBriefStore((s) => s.reanalyze);
  const applyBrief = useBriefStore((s) => s.applyBrief);
  const generateContent = useBriefStore((s) => s.generateContent);

  const isWorkbench = window.location.hash === '#/' || window.location.hash === '';

  // Dropdown state
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Build visible steps based on real state (not fixed 4-step list)
  const visibleSteps: { label: string; action: () => void; disabled: boolean; variant: 'default' | 'primary' | 'success' }[] = [];

  if (briefStage >= 1) {
    // Step 1: Analyze idea
    visibleSteps.push({
      label: briefGenerating ? '◌ 分析中...' : (briefStage >= 2 ? '✓ 已理解创意' : '✦ 分析想法'),
      action: () => { analyzeIdea(); showToast('正在理解创意…', 'info'); },
      disabled: briefGenerating || briefStage >= 2,
      variant: 'primary',
    });
  }

  if (briefStage === 2 && !briefApplied) {
    // Step 2: Confirm brief
    visibleSteps.push({
      label: '↻ 重新理解',
      action: () => { reanalyze(); },
      disabled: briefGenerating,
      variant: 'default',
    });
    visibleSteps.push({
      label: '✓ 确认 Brief',
      action: () => { applyBrief(); showToast('Brief 已应用', 'success'); },
      disabled: false,
      variant: 'primary',
    });
  }

  if (briefApplied) {
    // Step 3: Generate content
    visibleSteps.push({
      label: generationLoading ? '◌ 生成中...' : (contentReady ? '✓ 已生成' : '✦ 生成内容'),
      action: () => { generateContent(); },
      disabled: generationLoading || contentReady,
      variant: 'primary',
    });
  }

  if (contentReady) {
    // Publish moved to RightRail PublishCard — no duplicate button here
  }

  return (
    <div className="commandbar">
      <div className="commandbar-context">
        <span>☁</span>
        <span>{mode === 'live' ? 'Claude / GPT Image 服务已连接' : '演示模式：未配置密钥也可完整体验'}</span>
      </div>
      <div className="commandbar-actions">
        {isWorkbench && visibleSteps.length > 0 && (
          <>
            {visibleSteps.map((step, i) => (
              <button
                key={i}
                className={step.variant === 'primary' ? 'blue' : step.variant === 'success' ? 'green' : ''}
                type="button"
                onClick={step.action}
                disabled={step.disabled}
              >
                {step.label}
              </button>
            ))}
          </>
        )}

        {!isWorkbench && (
          <>
            <button className="blue" type="button" onClick={() => navigate('/')}>
              ✦ 返回工作台
            </button>
          </>
        )}

        <div className="more-menu" ref={menuRef}>
          <button type="button" aria-label="更多操作" onClick={() => setMenuOpen(v => !v)}>•••</button>
          {menuOpen && (
            <div className="more-menu-dropdown">
              <button type="button" onClick={() => { navigate('/'); setMenuOpen(false); }}>🏠 返回工作台</button>
              <button type="button" onClick={() => { window.location.reload(); }}>🔄 刷新页面</button>
              <button type="button" onClick={() => { window.open('http://192.168.77.99:8000/docs', '_blank'); setMenuOpen(false); }}>📖 API 文档</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
