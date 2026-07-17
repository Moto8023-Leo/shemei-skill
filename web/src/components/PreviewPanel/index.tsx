import { useMemo } from 'react';
import { useFormStore } from '../../store/useFormStore';

export default function PreviewPanel() {
  const content = useFormStore(s => s.content);
  const results = useFormStore(s => s.results);
  const generating = useFormStore(s => s.generating);
  const publishing = useFormStore(s => s.publishing);
  const publishFb = useFormStore(s => s.publishFb);
  const publishIg = useFormStore(s => s.publishIg);
  const publishX = useFormStore(s => s.publishX);
  const publishAll = useFormStore(s => s.publishAll);

  const xLen = content?.x_text?.length || 0;

  if (!content && !generating) {
    return (
      <div className="preview-empty">
        <div className="preview-empty-icon">📋</div>
        <p>Select parameters on the left and click "Generate Content"</p>
      </div>
    );
  }

  if (generating) {
    return (
      <div className="preview-empty">
        <div className="preview-empty-icon">🤖</div>
        <p>AI is generating your ad copy...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Title + Body */}
      <div className="preview-section">
        <h3>📢 Full Ad Copy (FB / IG)</h3>
        <div className="preview-title">{content?.title}</div>
        <div className="preview-body">{content?.body}</div>
        <div className="preview-tags">{content?.tags}</div>
        <div style={{marginTop: 8}}>
          <button className="btn btn-outline" style={{fontSize: 12}}
            onClick={() => {
              const text = `${content?.title}\n\n${content?.body}\n\n${content?.tags}`;
              navigator.clipboard.writeText(text);
            }}>
            📋 Copy Full Text
          </button>
        </div>
      </div>

      {/* X Tweet */}
      <div className="preview-section">
        <h3>🐦 X Tweet (≤280 chars)</h3>
        <div className="preview-x">{content?.x_text}</div>
        <div className={`char-count ${xLen > 280 ? 'warn' : ''}`}>
          {xLen} / 280 chars
        </div>
        <div style={{marginTop: 8}}>
          <button className="btn btn-outline" style={{fontSize: 12}}
            onClick={() => navigator.clipboard.writeText(content?.x_text || '')}>
            📋 Copy X Text
          </button>
        </div>
      </div>

      {/* Image Prompt */}
      <div className="preview-section">
        <h3>📸 Image Generation Prompt</h3>
        <div className="preview-image-prompt">{content?.image_prompt}</div>
        <div style={{marginTop: 8}}>
          <button className="btn btn-outline" style={{fontSize: 12}}
            onClick={() => navigator.clipboard.writeText(content?.image_prompt || '')}>
            📋 Copy Prompt
          </button>
        </div>
      </div>

      {/* Publish Buttons */}
      <div className="preview-section">
        <h3>🚀 Publish</h3>
        <div className="btn-group">
          <button className="btn btn-primary" onClick={publishFb} disabled={publishing}>
            FB
          </button>
          <button className="btn btn-primary" onClick={publishIg} disabled={publishing}>
            IG
          </button>
          <button className="btn btn-primary" onClick={publishX} disabled={publishing}>
            X
          </button>
        </div>
        <div style={{marginTop: 8}}>
          <button className="btn btn-success btn-block" onClick={publishAll} disabled={publishing}>
            {publishing ? 'Publishing...' : '⚡ Publish All (FB + IG + X)'}
          </button>
        </div>

        {/* Results */}
        {Object.keys(results).length > 0 && (
          <div style={{marginTop: 12}}>
            {Object.entries(results).map(([platform, r]) => (
              <div key={platform} className={`result-item ${r?.success ? 'result-ok' : 'result-fail'}`}>
                <span>{r?.success ? '✅' : '❌'}</span>
                <span style={{fontWeight: 600}}>{platform.toUpperCase()}</span>
                <span>{r?.success ? (r.url || 'Posted') : (r.error || 'Failed')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
