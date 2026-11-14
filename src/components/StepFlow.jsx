import { useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

export default function StepFlow({ steps, label = 'Fluxo interativo' }) {
  const [active, setActive] = useState(0);
  const current = steps[active];
  return (
    <div className="step-flow" aria-label={label}>
      <div className="step-flow-track">
        {steps.map((step, index) => (
          <div className="step-flow-unit" key={step.title}>
            <button
              type="button"
              className={`flow-node ${active === index ? 'is-active' : ''} ${index < active ? 'is-done' : ''}`}
              onClick={() => setActive(index)}
              aria-pressed={active === index}
              aria-label={`Etapa ${index + 1}: ${step.title}`}
            >
              <span className="flow-node-number">{String(index + 1).padStart(2, '0')}</span>
              <strong>{step.title}</strong>
            </button>
            {index < steps.length - 1 && <ArrowRight className="flow-arrow" size={16} aria-hidden="true" />}
          </div>
        ))}
      </div>
      <div className="flow-detail" aria-live="polite">
        <div className="flow-detail-index"><CheckCircle2 size={16} /> ETAPA {String(active + 1).padStart(2, '0')}</div>
        <strong>{current.title}</strong>
        <p>{current.description}</p>
      </div>
    </div>
  );
}
