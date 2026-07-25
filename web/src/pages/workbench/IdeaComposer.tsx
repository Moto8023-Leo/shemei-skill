import { useMemo } from 'react';
import { useBriefStore } from '../../store/useBriefStore';
import { useAppStore } from '../../store/useAppStore';

// Icon for random prompt chip
const RANDOM_ICON = <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 6 4 10 20 14 4 18 20 23 4"/><line x1="6" y1="10" x2="14" y2="10"/></svg>;
function generateRandomPrompt(brandName: string): string {
  const season = pick([
    '春季回暖', '夏季骑行旺季', '秋季通勤换车季', '冬季雨雪出行季',
    '开学季', '黑五促销季', '圣诞新年送礼季', '春季出游季',
    '夏日海滩季', '欧洲城市拥堵季', '油价上涨期',
  ]);
  const angle = pick([
    '推广 {brand} 电动滑板车',
    '主推 {brand} 长续航款电动滑板车',
    '推 {brand} 新款折叠电动车',
    '推广 {brand} 越野性能款电动车',
    '为新款 {brand} 做上市预热',
    '宣传 {brand} 高性价比入门款',
    '推广 {brand} 大功率性能版',
    '推 {brand} 城市通勤轻量版',
  ]);
  const audience = pick([
    '面向城市通勤白领', '面向大学新生', '面向公寓住户',
    '面向环保年轻用户', '面向越野骑行爱好者', '面向短途代步女性',
    '面向外卖/配送骑手', '面向周末休闲骑行者', '面向健身通勤族',
  ]);
  const emphasis = pick([
    '突出长续航不焦虑', '强调折叠收纳方便', '突出防水和全天候骑行',
    '强调轻量便携', '突出强劲爬坡动力', '强调低碳环保',
    '突出性价比，对比开车和公交', '强调夜间骑行安全',
    '突出智能 App 互联', '强调舒适减震体验',
    '突出城市停车难解决', '强调跟豪车一样的出行效率',
  ]);
  const avoid = pick([
    '不要制造里程焦虑', '不要硬推销', '不要贬低竞品',
    '不要写成危险警告', '语言轻松幽默', '保持专业克制',
    '不要用夸张极限词汇', '避免技术术语堆砌', '',
  ]);

  return `${season}，${angle.replace('{brand}', brandName)}，${audience}，${emphasis}${avoid ? '，' + avoid : ''}。`;
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

export default function IdeaComposer() {
  const idea = useBriefStore((s) => s.idea);
  const analysisStatus = useBriefStore((s) => s.analysisStatus);
  const briefVisible = useBriefStore((s) => s.briefVisible);
  const setIdea = useBriefStore((s) => s.setIdea);
  const analyzeIdea = useBriefStore((s) => s.analyzeIdea);
  const bootstrap = useAppStore((s) => s.bootstrap);

  const currentBrand = useMemo(() => {
    const brands = bootstrap?.brands || [];
    return brands.length > 0 ? brands[0].name : 'iENYRID';
  }, [bootstrap]);

  const loading = analysisStatus === 'loading';

  const handleAnalyze = () => {
    if (!idea.trim() || loading) return;
    analyzeIdea();
  };

  const handleRandom = () => {
    setIdea(generateRandomPrompt(currentBrand));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleAnalyze();
    }
  };

  return (
    <div className={`idea-card${briefVisible ? ' idea-card--compact' : ''}`}>
      <div className="idea-heading">
        <div className="idea-heading-icon">✦</div>
        <div>
          <h2>告诉 AI 你的推广想法</h2>
          <p>像和同事沟通一样描述背景、目标、卖点和限制，不必填写几十个字段。</p>
        </div>
      </div>

      <div className="composer-shell">
        <textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={1200}
          placeholder={`例如：${currentBrand === 'iENYRID' ? '欧洲进入秋季通勤季，想推广 iENYRID 电动滑板车，突出续航和防水……' : '美国夏季骑行旺季，想推广 KuKirin 越野电动车，突出动力和全地形……'}`}
          disabled={loading}
        />
        <div className="composer-meta">
          <span>{idea.length}/1200</span>
          <span>⌘+Enter 快速提交</span>
        </div>
      </div>

      <div className="idea-actions">
        <div className="prompt-chips" style={{ justifyContent: 'center' }}>
          <button
            type="button"
            className="chip-random"
            onClick={handleRandom}
            disabled={loading}
          >
            <i className="chip-icon">{RANDOM_ICON}</i>
            随机
          </button>
        </div>
        <button
          className="btn-analyze"
          type="button"
          onClick={handleAnalyze}
          disabled={loading || !idea.trim()}
        >
          {loading ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 2a10 10 0 1 0 10 10" />
              </svg>
              正在理解创意…
            </>
          ) : (
            <>✦ AI 整理我的想法</>
          )}
        </button>
      </div>

      {loading && (
        <div className="analysis-progress">
          <span />
          <p>正在结合品牌资料、产品信息和市场上下文生成 Creative Brief…</p>
        </div>
      )}
    </div>
  );
}
