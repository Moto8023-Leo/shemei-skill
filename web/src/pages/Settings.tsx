// Settings — system parameters, API keys, and Prompt Center
import { useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

// ------------------------------------------------------------------
// Prompt template types
// ------------------------------------------------------------------

interface PromptVersion {
  version: number;
  content: string;
  createdAt: string;
  active: boolean;
}

interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  versions: PromptVersion[];
}

const PROMPT_CATEGORIES: { id: string; name: string; description: string }[] = [
  { id: 'copy_rules', name: '文案规则', description: '社媒文案生成的核心规则与质量要求' },
  { id: 'image_rules', name: '图片规则', description: 'AI 生图的视觉风格与构图约束' },
  { id: 'product_protection', name: '产品保护', description: '产品完整性、参数安全表达规则' },
  { id: 'platform_rules', name: '平台规则', description: '各平台字数、格式、标签要求' },
  { id: 'holiday_rules', name: '节日规则', description: '节日营销活动的特殊提示词规则' },
];

const DEFAULT_PROMPTS: Record<string, string> = {
  copy_rules: `【Copywriting Quality Rules】
- BENEFIT FIRST: Every sentence answers "what's in it for me?".
- HOOK VARIETY: Rotate between questions, bold statements, data points, user scenarios.
- SHOW, DON'T TELL: "Arrive sweat-free after a 10km commute" > "Comfortable ride".
- URGENCY: End with a reason to click NOW.
- VOICE: Native, conversational English. Read it out loud.`,
  image_rules: `【Image Generation Rules】
- Main subject MUST be the full electric scooter, not cropped.
- Scene must match the campaign season and audience.
- Lighting: golden hour preferred, avoid harsh midday sun.
- Color palette: brand colors (blue #246bfd, dark #1a1a2e) should dominate.`,
  product_protection: `【Product Protection Rules】
- Range values MUST use "UP TO X KM RANGE" format, NEVER bare ranges.
- NEVER use absolute claims: "safest", "100%", "guaranteed".
- All specs must match the product data — never hallucinate.
- Product must be fully visible in images with 3.5% padding.`,
  platform_rules: `【Platform Rules】
- Facebook: 35-55 word body, 4 hashtags, product link in CTA.
- Instagram: visual-first, shorter copy, 4 hashtags + product link.
- X/Twitter: MAX 280 chars, 3 hashtags, front-load hook in first 50 chars.
- ALL: English only, 1-2 emojis max.`,
  holiday_rules: `【Holiday Campaign Rules】
- Pre-heat phase (14-1 days before): Build anticipation.
- Active phase: Strong CTA, time-sensitive language.
- Last chance: Maximum urgency.
- Image mood must match campaign season and target audience.`,
};

export default function Settings() {
  const bootstrap = useAppStore(s => s.bootstrap);
  const showToast = useAppStore(s => s.showToast);
  const serviceStatus = bootstrap?.serviceStatus || { deepseek: false, feishu: false, meta: false };

  const [activeTab, setActiveTab] = useState<string>('system');
  const [prompts, setPrompts] = useState<Record<string, PromptTemplate>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Load prompts from localStorage
  useEffect(() => {
    const loaded: Record<string, PromptTemplate> = {};
    for (const cat of PROMPT_CATEGORIES) {
      const saved = localStorage.getItem(`prompt-${cat.id}`);
      if (saved) {
        try { loaded[cat.id] = JSON.parse(saved); } catch {}
      } else {
        // Initialize with default
        loaded[cat.id] = {
          id: cat.id,
          name: cat.name,
          description: cat.description,
          versions: [{ version: 1, content: DEFAULT_PROMPTS[cat.id] || '', createdAt: new Date().toISOString(), active: true }],
        };
      }
    }
    setPrompts(loaded);
  }, []);

  const savePrompt = (id: string) => {
    const template = prompts[id];
    if (!template) return;
    const newVersion: PromptVersion = {
      version: template.versions.length + 1,
      content: editContent,
      createdAt: new Date().toISOString(),
      active: true,
    };
    // Deactivate old versions
    const updated = {
      ...template,
      versions: [...template.versions.map(v => ({ ...v, active: false })), newVersion],
    };
    const updatedPrompts = { ...prompts, [id]: updated };
    setPrompts(updatedPrompts);
    localStorage.setItem(`prompt-${id}`, JSON.stringify(updated));
    setEditingId(null);
    showToast('提示词已保存为新版本', 'success');
  };

  const activateVersion = (promptId: string, version: number) => {
    const template = prompts[promptId];
    if (!template) return;
    const updated = {
      ...template,
      versions: template.versions.map(v => ({ ...v, active: v.version === version })),
    };
    setPrompts({ ...prompts, [promptId]: updated });
    localStorage.setItem(`prompt-${promptId}`, JSON.stringify(updated));
    showToast(`版本 ${version} 已激活`, 'success');
  };

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      <div className="panel-heading">
        <div>
          <h2>系统设置</h2>
          <p>API 密钥、系统参数与提示词管理</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[{ id: 'system', label: '系统参数' }, { id: 'prompts', label: '提示词中心' }].map(tab => (
          <button
            key={tab.id}
            className={`select-chip ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
            style={{ border: '1px solid #dce3ed', borderRadius: 6, padding: '6px 14px', fontSize: 11, cursor: 'pointer', background: activeTab === tab.id ? '#246bfd' : '#fff', color: activeTab === tab.id ? '#fff' : '#3c4456' }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'system' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="rail-card" style={{ padding: 20 }}>
            <h4 style={{ margin: '0 0 12px' }}>API 服务状态</h4>
            <div className="quality-items">
              <div>
                <i className={serviceStatus.deepseek ? '' : 'warn'}>{serviceStatus.deepseek ? '✓' : '!'}</i>
                <span>DeepSeek（文案生成）</span>
                <b>{serviceStatus.deepseek ? '已配置' : '未配置'}</b>
              </div>
              <div>
                <i className={serviceStatus.feishu ? '' : 'warn'}>{serviceStatus.feishu ? '✓' : '!'}</i>
                <span>飞书多维表格</span>
                <b>{serviceStatus.feishu ? '已配置' : '未配置'}</b>
              </div>
              <div>
                <i className={serviceStatus.meta ? '' : 'warn'}>{serviceStatus.meta ? '✓' : '!'}</i>
                <span>Meta（FB / IG）</span>
                <b>{serviceStatus.meta ? '已配置' : '未配置'}</b>
              </div>
            </div>
          </div>

          <div className="rail-card" style={{ padding: 20 }}>
            <h4 style={{ margin: '0 0 12px' }}>运行模式</h4>
            <span className={`mode-pill ${bootstrap?.mode || 'demo'}`} style={{ fontSize: 11, padding: '6px 12px' }}>
              {bootstrap?.mode === 'live' ? '正式模式' : '演示模式'}
            </span>
            <p className="muted" style={{ marginTop: 8 }}>在 .env 中设置 DEMO_MODE=false 并配置 DEEPSEEK_API_KEY 切换正式模式</p>
          </div>

          <div className="rail-card" style={{ padding: 20 }}>
            <h4 style={{ margin: '0 0 12px' }}>系统参数</h4>
            <div className="form-stack">
              <label className="field"><span>最大上传文件大小 (MB)</span><input value={bootstrap?.limits?.maxUploadMb || 10} readOnly /></label>
              <label className="field"><span>请求超时 (ms)</span><input value="120000" readOnly /></label>
              <label className="field"><span>请求重试次数</span><input value="3" readOnly /></label>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'prompts' && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div className="rail-card" style={{ padding: 20 }}>
            <h4 style={{ margin: '0 0 4px' }}>提示词模板中心</h4>
            <p className="muted">管理 AI 生文和生图的提示词规则。编辑后自动创建新版本，可随时回退到历史版本。</p>
          </div>

          {PROMPT_CATEGORIES.map(cat => {
            const template = prompts[cat.id];
            const activeVersion = template?.versions.find(v => v.active);
            const isEditing = editingId === cat.id;

            return (
              <div key={cat.id} className="rail-card" style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <h5 style={{ margin: 0, fontSize: 12 }}>{cat.name}</h5>
                    <small className="muted">{cat.description}</small>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {template && (
                      <select
                        style={{ fontSize: 9, padding: '2px 4px', borderRadius: 4, border: '1px solid #dce3ed' }}
                        value={activeVersion?.version || 1}
                        onChange={(e) => activateVersion(cat.id, Number(e.target.value))}
                      >
                        {template.versions.map(v => (
                          <option key={v.version} value={v.version}>v{v.version} {v.active ? '(当前)' : ''}</option>
                        ))}
                      </select>
                    )}
                    <button
                      className="select-chip active"
                      style={{ fontSize: 9, padding: '4px 10px', border: '1px solid #dce3ed', borderRadius: 4, cursor: 'pointer' }}
                      onClick={() => {
                        if (isEditing) {
                          savePrompt(cat.id);
                        } else {
                          setEditingId(cat.id);
                          setEditContent(activeVersion?.content || DEFAULT_PROMPTS[cat.id] || '');
                        }
                      }}
                    >
                      {isEditing ? '保存' : '编辑'}
                    </button>
                    {isEditing && (
                      <button
                        style={{ fontSize: 9, padding: '4px 10px', border: '1px solid #dce3ed', borderRadius: 4, cursor: 'pointer', color: '#666' }}
                        onClick={() => setEditingId(null)}
                      >
                        取消
                      </button>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    style={{
                      width: '100%', minHeight: 200, fontFamily: 'monospace', fontSize: 10,
                      padding: 10, borderRadius: 6, border: '1px solid #dce3ed', resize: 'vertical',
                    }}
                  />
                ) : (
                  <pre style={{
                    background: '#f7f9fc', padding: 12, borderRadius: 6,
                    fontSize: 9.5, whiteSpace: 'pre-wrap', maxHeight: 200, overflow: 'auto',
                    margin: 0, color: '#3c4456', lineHeight: 1.6,
                  }}>
                    {activeVersion?.content || DEFAULT_PROMPTS[cat.id] || '未设置'}
                  </pre>
                )}

                {template && template.versions.length > 1 && !isEditing && (
                  <details style={{ marginTop: 8, fontSize: 9, color: '#8b94a2' }}>
                    <summary style={{ cursor: 'pointer' }}>版本历史 ({template.versions.length} 个版本)</summary>
                    <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
                      {template.versions.map(v => (
                        <li key={v.version} style={{ margin: '2px 0' }}>
                          v{v.version} — {new Date(v.createdAt).toLocaleString()} {v.active ? '✅ 当前' : ''}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
