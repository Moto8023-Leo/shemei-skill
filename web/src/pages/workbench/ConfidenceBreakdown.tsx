import { useMemo } from 'react';
import type { ConfidenceFactors } from '../../utils/api';

function confidenceLevel(score: number): 'great' | 'good' | 'warn' {
  if (score >= 85) return 'great';
  if (score >= 65) return 'good';
  return 'warn';
}

export default function ConfidenceBreakdown({ factors }: { factors: ConfidenceFactors | null }) {
  if (!factors) return null;

  const score = factors.computedScore;
  const level = confidenceLevel(score);

  const rows: { icon: string; label: string; detail: string; ok: boolean }[] = [
    {
      icon: '❓', label: '澄清问题',
      detail: factors.clarificationQuestions.count > 0
        ? `${factors.clarificationQuestions.count} 个待确认 (−${factors.clarificationQuestions.penalty})`
        : '无需补充',
      ok: factors.clarificationQuestions.count === 0,
    },
    {
      icon: '📋', label: '关键字段',
      detail: factors.missingKeyFields.fields.length > 0
        ? `缺失: ${factors.missingKeyFields.fields.join(', ')} (−${factors.missingKeyFields.penalty})`
        : '全部完整',
      ok: factors.missingKeyFields.fields.length === 0,
    },
    {
      icon: '👥', label: '受众/痛点',
      detail: factors.missingLists.fields.length > 0
        ? `未填写: ${factors.missingLists.fields.join(', ')} (−${factors.missingLists.penalty})`
        : '已覆盖',
      ok: factors.missingLists.fields.length === 0,
    },
    {
      icon: '🌍', label: '市场信息',
      detail: factors.market.missing.length > 0
        ? `缺失: ${factors.market.missing.join(', ')} (−${factors.market.penalty})`
        : '完整',
      ok: factors.market.missing.length === 0,
    },
    {
      icon: '🏷️', label: '优惠核实',
      detail: factors.offerUnverified.hasLabel
        ? `优惠已填写但未核实 (−${factors.offerUnverified.penalty})`
        : '无优惠/已确认',
      ok: !factors.offerUnverified.hasLabel,
    },
    ...(factors.bonuses.total > 0 ? [{
      icon: '⭐', label: '加分项',
      detail: [
        factors.bonuses.avoidList ? '避坑列表' : '',
        factors.bonuses.audienceSegments ? '受众细分' : '',
      ].filter(Boolean).join(', ') + ` (+${factors.bonuses.total})`,
      ok: true,
    }] : []),
  ];

  return (
    <details className="confidence-breakdown" open>
      <summary className={`conf-summary level-${level}`}>
        <span className="conf-score">{score}<small>/100</small></span>
        <span className="conf-tag">
          {level === 'great' ? '✓ 高置信' : level === 'good' ? '⚠ 建议确认' : '✗ 需核实'}
        </span>
        <svg className="conf-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 9 6 6 6-6"/></svg>
      </summary>
      <ul className="conf-detail-list">
        {rows.map((r) => (
          <li key={r.label} className={r.ok ? 'conf-ok' : 'conf-issue'}>
            <span className="conf-dot">{r.ok ? '✓' : '—'}</span>
            <strong>{r.label}</strong>
            <span className="conf-text">{r.detail}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}
