import { useMemo } from 'react';
import { useBriefStore } from '../../store/useBriefStore';

const ASSETS = [
  { key: 'copy', label: '社媒文案', icon: '✎' },
  { key: 'image', label: '图片 Prompt', icon: '◇' },
  { key: 'video', label: '视频 Prompt', icon: '▶' },
];

type Phase = 'queued' | 'running' | 'done';

export default function GenerationSkeleton() {
  const generationStatus = useBriefStore((s) => s.generationStatus);
  const generatedData = useBriefStore((s) => s.generatedData);
  const streamPhase = useBriefStore((s) => s.streamPhase);

  const phases: Record<string, Phase> = useMemo(() => {
    if (generationStatus === 'done' && generatedData) {
      return { copy: 'done', image: 'done', video: 'done' };
    }
    const isLoading = generationStatus === 'loading';
    if (!isLoading) return { copy: 'queued', image: 'queued', video: 'queued' };

    // SSE phases: "AI 正在生成社媒文案…" → "AI 正在生成图片 Prompt…" → "全部资产已生成完毕"
    const phase = streamPhase || '';
    const copying = !phase || phase.includes('文案');
    const imaging = phase.includes('图片');
    const allDone = phase.includes('完毕');

    if (allDone) return { copy: 'done', image: 'done', video: 'done' };
    if (imaging) return { copy: 'done', image: 'running', video: 'queued' };
    if (copying) return { copy: 'running', image: 'queued', video: 'queued' };
    return { copy: 'running', image: 'running', video: 'queued' };
  }, [generationStatus, generatedData, streamPhase]);

  const doneCount = Object.values(phases).filter(p => p === 'done').length;
  const isLoading = generationStatus === 'loading';

  return (
    <div className="generation-skeleton">
      <div className={`gen-spinner${doneCount >= 2 ? ' gen-spinner--done' : ''}`}>
        {doneCount >= 2 ? (
          '✓'
        ) : (
          <svg className="gen-spinner-ring" width="28" height="28" viewBox="0 0 28 28" fill="none">
            <circle cx="14" cy="14" r="11" stroke="#d4dff7" strokeWidth="2.5" />
            <circle cx="14" cy="14" r="11" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeDasharray="52 17" />
          </svg>
        )}
      </div>
      <header className="gen-header">
        <h3>AI 生成中</h3>
        <p>{isLoading
          ? streamPhase || 'DeepSeek 正在根据 Brief 生成多平台文案…'
          : '全部资产已生成完毕'}</p>
      </header>
      <div className="gen-task-bars">
        {ASSETS.map(a => {
          const p = phases[a.key];
          return (
            <div key={a.key} className={`gen-task-row${p === 'running' ? ' gen-task-row--active' : ''}${p === 'done' ? ' gen-task-row--done' : ''}`}>
              <span className="gen-task-icon">{a.icon}</span>
              <span className="gen-task-label">{a.label}</span>
              <span className="gen-task-status">
                {p === 'queued' && '排队中'}
                {p === 'running' && '生成中…'}
                {p === 'done' && '已完成'}
              </span>
              <span className="gen-task-bar">
                <i />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
