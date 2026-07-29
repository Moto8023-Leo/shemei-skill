import { useBriefStore } from '../../store/useBriefStore';

const TABS: [string, string, string?][] = [
  ['facebook', 'Facebook'],
  ['instagram', 'Instagram'],
  ['x', 'X'],
  ['image', '图片 Prompt'],
];

export default function ContentResults() {
  const generatedData = useBriefStore((s) => s.generatedData);
  const activeTab = useBriefStore((s) => s.activeTab);
  const reviewed = useBriefStore((s) => s.reviewed);
  const setActiveTab = useBriefStore((s) => s.setActiveTab);
  const toggleReview = useBriefStore((s) => s.toggleReview);
  const regenerate = useBriefStore((s) => s.regenerate);

  if (!generatedData) return null;

  const currentAsset = generatedData[activeTab as keyof typeof generatedData];
  if (!currentAsset) return null;

  const handleCopy = async () => {
    const text = `${currentAsset.title}\n\n${currentAsset.body}\n\n${currentAsset.footer}`;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard API might not be available
    }
  };

  return (
    <div className="result-panel">
      <div className="result-header">
        <div>
          <span className="section-kicker">生成结果</span>
          <h2>内容资产</h2>
        </div>
        <div className="result-actions">
          <button className="btn-secondary" type="button" onClick={handleCopy}>
            复制当前内容
          </button>
          <button className="btn-secondary" type="button" onClick={() => regenerate()}>
            重新生成
          </button>
        </div>
      </div>

      <div className="content-tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            className={`content-tab${activeTab === id ? ' is-active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            {label}
            {id === 'x' && <span className="char-badge">280</span>}
          </button>
        ))}
      </div>

      <article className="content-editor">
        <div className="editor-toolbar">
          <span className="editor-platform-label">
            {activeTab === 'image' || activeTab === 'video' ? 'Production Prompt' : 'Social Copy'}
          </span>
          <div className="editor-toolbar-actions">
            <button type="button" aria-label="撤销">↶</button>
            <button type="button" aria-label="重做">↷</button>
          </div>
        </div>

        {currentAsset.title && (
          <input
            className="content-title-input"
            value={currentAsset.title}
            readOnly
            aria-label="标题"
          />
        )}

        <textarea
          className="content-body-textarea"
          value={currentAsset.body}
          readOnly
          aria-label="正文"
        />

        <textarea
          className="content-footer-textarea"
          value={currentAsset.footer}
          readOnly
          aria-label="补充内容"
        />

        <div className="editor-footer">
          <span>AI 已按品牌语气优化</span>
          <span>{currentAsset.title.length + currentAsset.body.length} 字符</span>
        </div>
      </article>

      <div className="result-bottom">
        <div className="version-info">版本 1 · 由 DeepSeek 生成</div>
        <div className="result-actions">
          <button
            className={reviewed ? 'btn-success' : 'btn-primary'}
            type="button"
            onClick={toggleReview}
          >
            {reviewed ? '✓ 已标记为可审核' : '提交人工审核'}
          </button>
        </div>
      </div>
    </div>
  );
}
