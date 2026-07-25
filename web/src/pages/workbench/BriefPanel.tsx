import { useBriefStore } from '../../store/useBriefStore';
import type { BriefData } from '../../utils/api';
import ConfidenceBreakdown from './ConfidenceBreakdown';

function BriefFieldRow({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`brief-field${wide ? ' brief-field--wide' : ''}`}>
      <span className="bf-label">{label}</span>
      <strong className="bf-value">{value || '—'}</strong>
      <button className="bf-edit" aria-label={`编辑 ${label}`} type="button">
        <svg className="icon-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5Z" />
        </svg>
      </button>
    </div>
  );
}

function confidenceLevel(score: number): 'great' | 'good' | 'warn' {
  if (score >= 85) return 'great';
  if (score >= 65) return 'good';
  return 'warn';
}

export default function BriefPanel() {
  const briefVisible = useBriefStore((s) => s.briefVisible);
  const briefData = useBriefStore((s) => s.briefData);
  const confidenceFactors = useBriefStore((s) => s.confidenceFactors);
  const briefApplied = useBriefStore((s) => s.briefApplied);
  const errorMessage = useBriefStore((s) => s.errorMessage);
  const reanalyze = useBriefStore((s) => s.reanalyze);
  const applyBrief = useBriefStore((s) => s.applyBrief);

  if (!briefVisible || !briefData) return null;

  const b = briefData;

  const marketLabel = b.market
    ? `${b.market.country || ''} · ${b.market.language || ''}`.trim()
    : '';

  const handleApply = async () => {
    await applyBrief();
    // Scroll to the streamlined panel after brief is applied
    setTimeout(() => {
      document.querySelector('.streamlined-param-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 150);
  };

  return (
    <div className={`brief-panel${briefApplied ? ' is-applied' : ''}`}>
      <div className="panel-head">
        <div>
          <span className="section-kicker">AI 理解结果</span>
          <h2>Creative Brief</h2>
          <p>AI 只提供建议，确认后才会写入内容参数。</p>
        </div>
        <ConfidenceBreakdown factors={confidenceFactors} />
      </div>

      <div className="brief-grid">
        <BriefFieldRow label="活动主题" value={b.campaignTheme} />
        <BriefFieldRow label="目标市场" value={marketLabel} />
        <BriefFieldRow label="目标用户" value={(b.audience || []).join(', ')} />
        <BriefFieldRow label="核心痛点" value={(b.painPoints || []).join(', ')} />
        <BriefFieldRow label="传播角度" value={b.messageAngle} />
        <BriefFieldRow label="优惠信息" value={b.offer?.label || ''} />
        <BriefFieldRow label="视觉方向" value={b.visualDirection} wide />
        <BriefFieldRow label="语气约束" value={(b.tone || []).join(', ')} wide />
      </div>

      {b.avoid && b.avoid.length > 0 && (
        <div className="brief-notice">
          <svg className="icon-svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3 5 6v5c0 4.6 2.9 8.2 7 10 4.1-1.8 7-5.4 7-10V6l-7-3Z" /><path d="m9 12 2 2 4-4" />
          </svg>
          <span>已自动避开：{(b.avoid || []).join('、')}</span>
        </div>
      )}

      {errorMessage && (
        <div className="warning-box" style={{ marginTop: 10 }}>
          <svg className="icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 4 3 20h18L12 4Z" /><path d="M12 9v5M12 17h.01" />
          </svg>
          {errorMessage}
        </div>
      )}

      <div className="panel-actions">
        <button className="btn-secondary" type="button" onClick={() => reanalyze()}>
          ↻ 重新理解
        </button>
        {briefApplied ? (
          <span className="applied-state">
            <svg className="icon-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m5 12 4 4L19 6" />
            </svg>
            已应用到内容参数
          </span>
        ) : (
          <button className="btn-primary" type="button" onClick={handleApply}>
            确认 Brief，继续配置参数 →
          </button>
        )}
      </div>
    </div>
  );
}
