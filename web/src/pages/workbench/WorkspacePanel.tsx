// WorkspacePanel — center column (content preview + image stage)
import { useMemo } from 'react';
import { useStudioStore } from '../../store/useStudioStore';
import { useAppStore } from '../../store/useAppStore';

const PLATFORM_LABELS: Record<string, string> = { facebook: 'Facebook', instagram: 'Instagram', x: 'X（Twitter）' };
const SIZE_LABELS: [string, string][] = [
  ['master', '无字主视觉'], ['portrait', '4:5'], ['square', '1:1'], ['landscape', '16:9'],
];

export default function WorkspacePanel() {
  const content = useStudioStore(s => s.content);
  const generating = useStudioStore(s => s.generating);
  const activePlatform = useStudioStore(s => s.activePlatform);
  const activeImage = useStudioStore(s => s.activeImage);
  const setField = useStudioStore(s => s.setField);
  const overlayPosition = useStudioStore(s => s.overlayPosition);
  const showToast = useAppStore(s => s.showToast);

  const platformText = useMemo(() => {
    if (!content) return '';
    if (activePlatform === 'facebook') return content.facebookText;
    if (activePlatform === 'instagram') return content.instagramText || content.facebookText;
    return content.xText;
  }, [content, activePlatform]);

  // Empty state
  if (!content && !generating) {
    return (
      <section className="workspace-panel empty-workspace">
        <div className="empty-illustration">✦</div>
        <h2>准备生成第一组内容</h2>
        <p>左侧选择产品与市场，上传真实产品图后点击"生成完整内容"。系统会同时生成社媒文案、无字底图提示词、叠字文案和三个平台尺寸。</p>
        <div className="empty-steps">
          <span>1. 选择市场</span>
          <span>2. 上传产品图</span>
          <span>3. 生成并审核</span>
        </div>
      </section>
    );
  }

  // Loading state
  if (generating) {
    return (
      <section className="workspace-panel loading-workspace">
        <div className="generation-orbit">✦</div>
        <h2>正在生成内容</h2>
        <p>AI 正在规划文案与视觉策略，系统会自动重试短暂失败的请求。</p>
        <div className="progress-track"><span /></div>
      </section>
    );
  }

  if (!content) return null;

  const positionClass = overlayPosition === '右侧' ? 'right' : overlayPosition === '底部' ? 'bottom' : '';

  return (
    <section className="workspace-panel">
      {/* Tabs */}
      <div className="workspace-tabs">
        <button className="active" type="button">生成结果</button>
        <button type="button">历史版本</button>
        <span className={`mode-pill ${content.mode || 'demo'}`}>
          {content.mode === 'live' ? '正式生成' : '演示生成'}
        </span>
      </div>

      {/* Copy Block */}
      <div className="content-block copy-block">
        <div className="block-title">
          <div><span className="title-mark" />社媒文案</div>
          <div className="block-actions">
            <button type="button" onClick={() => showToast('重新生成时会自动切换卖点和视觉组合', 'info')}>✦ AI 优化</button>
            <button type="button" onClick={() => { navigator.clipboard.writeText(platformText); showToast('已复制', 'success'); }}>▣ 复制</button>
          </div>
        </div>
        <div className="platform-tabs">
          {(Object.keys(PLATFORM_LABELS) as string[]).map(p => (
            <button key={p} className={activePlatform === p ? 'active' : ''} type="button" onClick={() => setField('activePlatform', p)}>
              {PLATFORM_LABELS[p]}
            </button>
          ))}
        </div>
        <h3>{content.title}</h3>
        <div className="generated-copy">{platformText}</div>
        <div className="copy-meta">
          <div className="hashtags">
            {(content.hashtags || []).slice(0, 6).map(tag => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <span className="char-count">{platformText.length} 字符</span>
        </div>
      </div>

      {/* Prompt Block */}
      <div className="content-block prompt-block">
        <div className="block-title">
          <div><span className="title-mark" />无字底图提示词（Prompt）</div>
          <button type="button" onClick={() => { navigator.clipboard.writeText(content.imagePrompt); showToast('提示词已复制', 'success'); }}>▣ 复制 Prompt</button>
        </div>
        <p>{content.imagePrompt}</p>
        {content.negativePrompt && (
          <details>
            <summary>查看锁定负面提示词</summary>
            <p>{content.negativePrompt}</p>
          </details>
        )}
      </div>

      {/* Image Stage — always show if we have a product image, even without AI images */}
      <div className="visual-row">
        <div className="content-block image-stage-block">
          <div className="block-title">
            <div>▧ 图片预览</div>
            <div className="block-actions">
              <button type="button" onClick={() => showToast('重新生成功能开发中', 'info')}>↻ 重新生成</button>
            </div>
          </div>
          <div className="image-stage">
            {content.images?.master ? (
              <img src={content.images[activeImage] || content.images.master} alt="生成的广告图" />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: '#8b94a2', fontSize: 13 }}>
                ▧ 图片将在 AI 生成后显示
              </div>
            )}
            {content.overlay && (
              <div className={`image-overlay-caption ${positionClass}`}>
                <span>{content.overlay.eyebrow}</span>
                <strong>{content.overlay.headline}</strong>
                <small>{content.overlay.support}</small>
                <b>{content.overlay.offer}</b>
              </div>
            )}
          </div>
          <div className="image-thumbnails">
            {SIZE_LABELS.map(([key, label]) => (
              <button key={key} type="button" className={activeImage === key ? 'active' : ''} onClick={() => setField('activeImage', key)}>
                <img src={content.images?.[key] || content.images?.master || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"/>'} alt={label} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="content-block size-preview-block">
          <div className="block-title"><div><span className="title-mark" />多平台尺寸</div></div>
          <div className="size-preview-item portrait">
            <span>Instagram / Facebook（4:5）</span>
            <img src={content.images?.portrait || content.images?.master || ''} alt="4:5" />
          </div>
          <div className="size-preview-item square">
            <span>通用（1:1）</span>
            <img src={content.images?.square || content.images?.master || ''} alt="1:1" />
          </div>
          <div className="size-preview-item landscape">
            <span>X（16:9）</span>
            <img src={content.images?.landscape || content.images?.master || ''} alt="16:9" />
          </div>
        </div>
      </div>
    </section>
  );
}
