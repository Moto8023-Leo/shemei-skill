import { useMemo } from 'react';
import { useBriefStore } from '../../store/useBriefStore';

const STEPS = [
  { n: 1, label: '描述想法', desc: '自然语言描述推广需求' },
  { n: 2, label: '确认 Brief', desc: 'AI 解析意图，人工确认' },
  { n: 3, label: '生成 & 审核', desc: 'AI 生成文案，审核后发布' },
];

export default function WorkflowStepper() {
  const stage = useBriefStore((s) => s.stage);

  // Map original 4 stages → 3 visual stages
  const visualStage = useMemo(() => Math.min(stage, 3), [stage]);

  return (
    <div className="workflow-stepper" aria-label="创作流程">
      {STEPS.map((step, i) => {
        const complete = visualStage > step.n;
        const active = visualStage === step.n;
        return (
          <div
            key={step.n}
            className={`workflow-step${complete ? ' is-complete' : ''}${active ? ' is-active' : ''}`}
          >
            <div className="workflow-step-index">
              {complete ? (
                <svg className="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 12 4 4L19 6" />
                </svg>
              ) : (
                step.n
              )}
            </div>
            <div className="workflow-step-body">
              <strong>{step.label}</strong>
              <span>{step.desc}</span>
            </div>
            {i < STEPS.length - 1 && <div className="workflow-step-line" />}
          </div>
        );
      })}
    </div>
  );
}
