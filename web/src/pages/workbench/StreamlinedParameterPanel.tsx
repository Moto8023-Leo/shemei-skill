import { useBriefStore } from '../../store/useBriefStore';

// Map common English brief values to Chinese for operator display
const MARKET_CN: Record<string, string> = {
  GB: '英国', US: '美国', DE: '德国', FR: '法国', ES: '西班牙',
  IT: '意大利', NL: '荷兰', CA: '加拿大', AU: '澳大利亚',
  'United Kingdom': '英国',
};
const LANG_CN: Record<string, string> = {
  en: '英语', de: '德语', fr: '法语', es: '西班牙语', it: '意大利语',
  nl: '荷兰语', 'en-GB': '英语（英式）', 'en-US': '英语（美式）',
};
const TONE_CN: Record<string, string> = {
  Energetic: '活力', Friendly: '亲和', Professional: '专业',
  Bold: '大胆', Warm: '温暖', Humorous: '幽默', Urgent: '紧迫',
  Confident: '自信', Inspiring: '鼓舞', Casual: '轻松',
  Excited: '兴奋', Free: '自由', Empowered: '赋能',
  Adventurous: '冒险', Trustworthy: '可靠',
};

function cn(val: string): string {
  if (!val) return '';
  return MARKET_CN[val] || LANG_CN[val] || TONE_CN[val] || val;
}

export default function StreamlinedParameterPanel() {
  const briefApplied = useBriefStore((s) => s.briefApplied);
  const params = useBriefStore((s) => s.params);
  const advancedOpen = useBriefStore((s) => s.advancedOpen);
  const generationStatus = useBriefStore((s) => s.generationStatus);
  const setParam = useBriefStore((s) => s.setParam);
  const togglePlatform = useBriefStore((s) => s.togglePlatform);
  const toggleAdvanced = useBriefStore((s) => s.toggleAdvanced);
  const generateContent = useBriefStore((s) => s.generateContent);

  if (!briefApplied) return null;

  const generating = generationStatus === 'loading';

  return (
    <div className="streamlined-param-panel">
      <div className="panel-head panel-head--compact" style={{ marginBottom: 16 }}>
        <div>
          <span className="section-kicker">已从 Brief 自动填充</span>
          <h2 style={{ margin: 0, fontSize: 17 }}>内容参数</h2>
        </div>
        <button className="text-button" type="button" onClick={toggleAdvanced}>
          {advancedOpen ? '收起高级设置 ▲' : '查看高级设置 ▼'}
        </button>
      </div>

      <div className="parameter-grid">
        <div className="param-field">
          <span>市场 / 语言</span>
          <div className="field-control">{cn(params.market)} · {cn(params.language)}</div>
        </div>

        <div className="param-field">
          <span>目标用户</span>
          <input
            className="field-control"
            style={{ border: 0, padding: 0 }}
            value={cn(params.audience)}
            onChange={(e) => setParam('audience', e.target.value)}
          />
        </div>

        <div className="param-field">
          <span>核心卖点</span>
          <input
            className="field-control"
            style={{ border: 0, padding: 0 }}
            value={cn(params.sellingPoint)}
            onChange={(e) => setParam('sellingPoint', e.target.value)}
          />
        </div>

        <div className="param-field">
          <span>优惠</span>
          <input
            className="field-control"
            style={{ border: 0, padding: 0 }}
            value={cn(params.offer)}
            onChange={(e) => setParam('offer', e.target.value)}
          />
        </div>

        <div className="param-field">
          <span>语气</span>
          <input
            className="field-control"
            style={{ border: 0, padding: 0 }}
            value={cn(params.tone)}
            onChange={(e) => setParam('tone', e.target.value)}
          />
        </div>

        <div className="param-field param-field--platforms">
          <span>发布平台</span>
          <div className="param-platform-row">
            {['Facebook', 'Instagram', 'X'].map((p) => (
              <button
                key={p}
                type="button"
                className={`param-platform-chip${params.platforms.includes(p) ? ' is-selected' : ''}`}
                onClick={() => togglePlatform(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      {advancedOpen && (
        <div className="advanced-panel">
          <div className="param-field">
            <span>CTA</span>
            <div className="field-control">Upgrade Your Brakes</div>
          </div>
          <div className="param-field">
            <span>文案长度</span>
            <div className="field-control">平台自适应</div>
          </div>
          <div className="param-field">
            <span>品牌禁用表达</span>
            <div className="field-control">绝对安全、零风险、100% 防事故</div>
          </div>
          <div className="param-field">
            <span>图片比例</span>
            <div className="field-control">Facebook 4:5 · Instagram 4:5 · X 16:9</div>
          </div>
        </div>
      )}

      <div className="generate-strip">
        <div>
          <strong>参数已就绪，开始生成</strong>
          <span>Facebook、Instagram、X 文案 + 图片 Prompt</span>
        </div>
        <button
          className="btn-primary"
          type="button"
          onClick={generateContent}
          disabled={generating}
        >
          {generating ? '生成中…' : '✦ 开始生成'}
        </button>
      </div>
    </div>
  );
}
