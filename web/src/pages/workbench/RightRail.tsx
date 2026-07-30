// RightRail — Task status + quality + publish (Creative Brief aware).
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBriefStore } from '../../store/useBriefStore';
import { useCalendarStore } from '../../store/useCalendarStore';

function computeDynamicQuality(briefData: any, generatedData: any, generationStatus: string) {
  if (generationStatus !== 'done' || !generatedData) {
    if (generationStatus === 'error') return { score: 45, level: '生成失败', hasBlocking: true, brandCon: 0, productAcc: 0, platformFit: 0 };
    return { score: 0, level: '待生成', hasBlocking: false, brandCon: 0, productAcc: 0, platformFit: 0 };
  }

  // Base score starts at 85 (same as before for backward compat)
  let score = 85;
  let brandCon = 89;
  let productAcc = 85;
  let platformFit = 79;

  // Adjust based on real content if available
  const fbBody = (generatedData?.facebook?.body || '').toLowerCase();
  const fbTitle = (generatedData?.facebook?.title || '').toLowerCase();
  const igBody = (generatedData?.instagram?.body || '').toLowerCase();
  const xBody = (generatedData?.x?.body || '').toLowerCase();
  const allText = fbBody + fbTitle + igBody + xBody;

  // Brand consistency: check for brand mentions
  const brandMentions = (allText.match(/ienyrid/gi) || []).length;
  if (brandMentions < 2) { score -= 10; brandCon -= 15; }
  else if (brandMentions >= 4) brandCon = Math.min(100, brandCon + 6);

  // Product accuracy: check for spec mentions
  const hasSpecs = /\d+km|\d+wh?|\d+w/i.test(allText);
  if (!hasSpecs) { score -= 8; productAcc -= 12; }

  // Platform fit: check length appropriateness
  const fbLen = (generatedData?.facebook?.body || '').length;
  const xLen = (generatedData?.x?.body || '').length;
  if (xLen > 280) { score -= 10; platformFit -= 20; }
  if (fbLen < 50 || fbLen > 600) { score -= 5; platformFit -= 8; }

  // Hashtag quality
  const hasHashtags = /#\w+/.test(allText);
  if (!hasHashtags) { score -= 8; productAcc -= 10; }

  // Clamp scores
  brandCon = Math.max(0, Math.min(100, brandCon));
  productAcc = Math.max(0, Math.min(100, productAcc));
  platformFit = Math.max(0, Math.min(100, platformFit));
  score = Math.max(20, Math.min(100, score));

  let level = '可以进入审核';
  let hasBlocking = false;
  if (score < 60) { level = '需调整'; hasBlocking = true; }
  else if (score < 75) level = '建议优化后再审';
  else if (score >= 90) level = '质量优秀';

  return { score, level, hasBlocking, brandCon, productAcc, platformFit };
}

export default function RightRail() {
  const generatedData = useBriefStore((s) => s.generatedData);

  // When content is generated and ready for review, lift PublishCard to top
  if (generatedData) {
    return (
      <aside className="right-rail">
        <PublishCard />
        <TaskStatusCard />
        <BriefConfidenceCard />
        <ContentQualityCard />
        <CampaignCard />
      </aside>
    );
  }

  return (
    <aside className="right-rail">
      <TaskStatusCard />
      <BriefConfidenceCard />
      <ContentQualityCard />
      <CampaignCard />
      <PublishCard />
    </aside>
  );
}

function TaskStatusCard() {
  const stage = useBriefStore((s) => s.stage);
  const generationStatus = useBriefStore((s) => s.generationStatus);
  const reviewed = useBriefStore((s) => s.reviewed);
  const briefData = useBriefStore((s) => s.briefData);
  const { label, progress } = useMemo(() => {
    let l = '等待创意输入', p = 18;
    if (stage >= 2 && generationStatus === 'idle') { l = 'Creative Brief 已生成'; p = 48; }
    if (stage >= 2 && generationStatus !== 'idle') { l = '参数已确认'; p = 68; }
    if (generationStatus === 'loading') { l = '正在生成内容'; p = 82; }
    if (generationStatus === 'done') { l = reviewed ? '等待发布审批' : '等待人工审核'; p = reviewed ? 95 : 90; }
    return { label: l, progress: p };
  }, [stage, generationStatus, reviewed]);

  return (
    <section className="rail-card">
      <div className="rail-title"><div><span>●</span>当前任务</div><span style={{ padding: '4px 7px', borderRadius: 999, background: 'var(--green-soft)', color: 'var(--green)', fontSize: 8, fontWeight: 700 }}>进行中</span></div>
      <strong style={{ display: 'block', marginTop: 14, fontSize: 12 }}>
        {briefData?.campaignTheme || 'iENYRID 内容创作'}
      </strong>
      <p style={{ margin: '5px 0 12px', color: 'var(--muted)', fontSize: 9 }}>{label}</p>
      <div style={{ height: 6, borderRadius: 99, background: '#edf1f6', overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', width: `${progress}%`, borderRadius: 'inherit', background: 'linear-gradient(90deg, var(--blue), #70a0ff)', transition: 'width .5s ease' }} />
      </div>
      <div style={{ marginTop: 7, display: 'flex', justifyContent: 'space-between', color: '#98a2b3', fontSize: 8 }}>
        <span>{progress}%</span><span>自动保存于刚刚</span>
      </div>
    </section>
  );
}

function BriefConfidenceCard() {
  const briefData = useBriefStore((s) => s.briefData);
  const confidenceFactors = useBriefStore((s) => s.confidenceFactors);
  const confidence = useMemo(() => {
    // Prefer computed score from backend; fall back to old self-reported value
    if (confidenceFactors?.computedScore != null) return confidenceFactors.computedScore;
    return Math.round((briefData?.confidence ?? 0) * 100);
  }, [briefData, confidenceFactors]);
  if (!briefData) return null;

  // Build breakdown lines from factors when available
  const breakdownLines: { label: string; ok: boolean }[] = confidenceFactors
    ? [
        { label: `澄清问题 ${confidenceFactors.clarificationQuestions.count} 个`, ok: confidenceFactors.clarificationQuestions.count === 0 },
        { label: `关键字段 ${confidenceFactors.missingKeyFields.fields.length > 0 ? '缺失' + confidenceFactors.missingKeyFields.penalty : '完整'}`, ok: confidenceFactors.missingKeyFields.fields.length === 0 },
        { label: `市场信息 ${confidenceFactors.market.missing.length > 0 ? '不完整' : '完整'}`, ok: confidenceFactors.market.missing.length === 0 },
      ]
    : [];

  return (
    <section className="rail-card">
      <div className="rail-title"><div><span>✓</span>Brief 置信度</div></div>
      <div className="score-line">
        <span>AI 理解评分</span>
        <strong>{confidence}<small>/100</small></strong>
        <b className={confidence >= 85 ? 'level-great' : confidence >= 65 ? 'level-good' : 'level-warn'}>
          {confidence >= 85 ? '高置信' : confidence >= 65 ? '建议确认' : '需核实'}
        </b>
      </div>
      {breakdownLines.length > 0 && (
        <div className="quality-items" style={{ marginTop: 6 }}>
          {breakdownLines.map((line, i) => (
            <div key={i}><i style={{ background: line.ok ? '#16a36b' : '#f3a61d' }}>{line.ok ? '✓' : '—'}</i><span>{line.label}</span></div>
          ))}
        </div>
      )}
      {briefData.clarificationQuestions?.length > 0 && (
        <div className="quality-items" style={{ marginTop: 8 }}>
          {briefData.clarificationQuestions.map((q: string, i: number) => (
            <div key={i}><i className="warn">!</i><span>{q}</span></div>
          ))}
        </div>
      )}
    </section>
  );
}

function ContentQualityCard() {
  const generationStatus = useBriefStore((s) => s.generationStatus);
  const generatedData = useBriefStore((s) => s.generatedData);
  const briefData = useBriefStore((s) => s.briefData);
  const { score, level, hasBlocking, brandCon, productAcc, platformFit } = useMemo(
    () => computeDynamicQuality(briefData, generatedData, generationStatus),
    [generationStatus, generatedData, briefData],
  );
  return (
    <section className="rail-card">
      <div className="rail-title"><div><span>✓</span>内容质量</div></div>
      <div className="score-line">
        <span>AI 评分</span>
        <strong>{score}<small>/100</small></strong>
        <b className={hasBlocking ? 'level-blocking' : score >= 85 ? 'level-great' : score >= 70 ? 'level-good' : 'level-warn'}>{level}</b>
      </div>
      <div className="quality-items">
        <div><i style={{ background: brandCon >= 75 ? '#16a36b' : '#f3a61d' }}>{brandCon >= 75 ? '✓' : '!'}</i><span>品牌一致性</span><b>{brandCon || '—'}</b></div>
        <div><i style={{ background: productAcc >= 75 ? '#16a36b' : '#f3a61d' }}>{productAcc >= 75 ? '✓' : '!'}</i><span>产品准确性</span><b>{productAcc || '—'}</b></div>
        <div><i style={{ background: platformFit >= 75 ? '#16a36b' : '#f3a61d' }}>{platformFit >= 75 ? '✓' : '!'}</i><span>平台适配度</span><b>{platformFit || '—'}</b></div>
      </div>
    </section>
  );
}

function CampaignCard() {
  const navigate = useNavigate();
  const events = useCalendarStore((s) => s.events);
  const currentEvent = Array.isArray(events) ? events[0] : null;
  return (
    <section className="rail-card campaign-card">
      <div className="rail-title"><div><span>▣</span>当前活动与预热</div>
        <button type="button" onClick={() => navigate('/calendar')}>查看日历</button>
      </div>
      {currentEvent ? (
        <div className="event-card">
          <div className="event-card-top"><strong>{currentEvent.name}</strong><span>{currentEvent.phase}</span></div>
          <small>{currentEvent.startDate} 至 {currentEvent.endDate} · {currentEvent.type}</small>
          <p>{currentEvent.recommendation}</p>
        </div>
      ) : <p className="muted">当前没有匹配活动，将使用常规内容策略。</p>}
    </section>
  );
}

function PublishCard() {
  const generatedData = useBriefStore((s) => s.generatedData);
  const publishStatus = useBriefStore((s) => s.publishStatus);
  const publishResult = useBriefStore((s) => s.publishResult);
  const publishedPlatforms = useBriefStore((s) => s.publishedPlatforms);
  const publishContent = useBriefStore((s) => s.publishContent);

  // Hide card entirely when there's no generated data or no brief (workflow not started)
  if (!generatedData) return null;

  // ── Done State ──
  if (publishStatus === 'done') {
    const fbOk = publishedPlatforms.includes('fb');
    const igOk = publishedPlatforms.includes('ig');
    const xOk = publishedPlatforms.includes('x');
    return (
      <section className="rail-card review-card done-card">
        <div className="rail-title"><div><span className="check-icon">✓</span>已发布</div></div>
        <p className="published-hint">{publishResult || '三平台发布任务已下发'}</p>
        <div className="platform-tags">
          <span className={`ptag ptag-fb${fbOk ? '' : ' ptag-fail'}`}>FB {fbOk ? '✓' : '✗'}</span>
          <span className={`ptag ptag-ig${igOk ? '' : ' ptag-fail'}`}>IG {igOk ? '✓' : '✗'}</span>
          <span className={`ptag ptag-x${xOk ? '' : ' ptag-fail'}`}>X {xOk ? '✓' : '✗'}</span>
        </div>
        <button className="publish-main done-btn" type="button" disabled>✓ 发布完成</button>
        <button className="sync-feishu" type="button" disabled>回写飞书多维表格</button>
      </section>
    );
  }

  // ── Loading State ──
  if (publishStatus === 'loading') {
    return (
      <section className="rail-card review-card">
        <div className="rail-title"><div><span className="spinner-icon">⟳</span>发布中</div></div>
        <p className="publishing-hint">任务已下发，社媒正在发布中…</p>
        <button className="publish-main" type="button" disabled>⟳ 发布中…</button>
        <button className="sync-feishu" type="button" disabled>回写飞书多维表格</button>
      </section>
    );
  }

  // ── Error State ──
  const publishError = useBriefStore((s) => s.errorMessage);
  if (publishStatus === 'error' || publishError) {
    return (
      <section className="rail-card review-card error-card">
        <div className="rail-title"><div><span>✕</span>发布失败</div></div>
        <p className="error-hint" style={{ color: 'var(--color-error, #e53e3e)', fontSize: 13 }}>{publishError || '发布请求失败，请稍后重试。'}</p>
        <button className="publish-main" type="button" onClick={publishContent}>↻ 重试发布</button>
        <button className="sync-feishu" type="button" disabled>回写飞书多维表格</button>
      </section>
    );
  }

  // ── Idle/Ready State (default) ──
  return (
    <section className="rail-card review-card">
      <div className="rail-title"><div><span>➤</span>发布</div></div>
      <p className="ready-hint">内容已生成，点击发布到 FB + IG + X</p>
      <button className="publish-main" type="button" onClick={publishContent}>➤ 审核通过并发布</button>
      <button className="sync-feishu" type="button" disabled>回写飞书多维表格</button>
    </section>
  );
}
