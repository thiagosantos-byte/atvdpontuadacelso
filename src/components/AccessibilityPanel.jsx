import { useEffect, useState } from 'react';
import { Accessibility, Minus, Plus, RotateCcw, X } from 'lucide-react';

const STORAGE_KEY = 'idlab-accessibility-v1';
const defaults = { scale: 1, contrast: false, reducedMotion: false, simplified: false };

function readSettings() {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
  catch { return defaults; }
}

export default function AccessibilityPanel() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(readSettings);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    document.documentElement.style.setProperty('--reading-scale', String(settings.scale));
    document.documentElement.dataset.highContrast = String(settings.contrast);
    document.documentElement.dataset.reducedMotion = String(settings.reducedMotion);
    document.documentElement.dataset.simplified = String(settings.simplified);
  }, [settings]);

  const update = (key, value) => setSettings((current) => ({ ...current, [key]: value }));

  return (
    <div className="accessibility-wrap">
      <button className="icon-action" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-controls="accessibility-panel" aria-label="Abrir controles de acessibilidade">
        <Accessibility size={18} /> <span className="action-label">Acessibilidade</span>
      </button>
      {open && (
        <section className="accessibility-panel" id="accessibility-panel" aria-label="Configurações de acessibilidade">
          <div className="panel-head">
            <div><span className="eyebrow">PREFERÊNCIAS DE LEITURA</span><h2>Acessibilidade</h2></div>
            <button className="bare-icon" type="button" onClick={() => setOpen(false)} aria-label="Fechar painel"><X size={18} /></button>
          </div>
          <div className="access-setting">
            <div><strong>Tamanho do texto</strong><span>Escala de leitura</span></div>
            <div className="stepper-controls">
              <button type="button" onClick={() => update('scale', Math.max(0.9, +(settings.scale - 0.05).toFixed(2)))} aria-label="Diminuir texto"><Minus size={15} /></button>
              <output>{Math.round(settings.scale * 100)}%</output>
              <button type="button" onClick={() => update('scale', Math.min(1.2, +(settings.scale + 0.05).toFixed(2)))} aria-label="Aumentar texto"><Plus size={15} /></button>
            </div>
          </div>
          <label className="switch-row"><span><strong>Alto contraste</strong><small>Reforça contornos e contraste textual.</small></span><input type="checkbox" checked={settings.contrast} onChange={(e) => update('contrast', e.target.checked)} /></label>
          <label className="switch-row"><span><strong>Reduzir animações</strong><small>Desativa transições não essenciais.</small></span><input type="checkbox" checked={settings.reducedMotion} onChange={(e) => update('reducedMotion', e.target.checked)} /></label>
          <label className="switch-row"><span><strong>Leitura simplificada</strong><small>Reduz elementos decorativos e largura de leitura.</small></span><input type="checkbox" checked={settings.simplified} onChange={(e) => update('simplified', e.target.checked)} /></label>
          <button className="reset-access" type="button" onClick={() => setSettings(defaults)}><RotateCcw size={14} /> Restaurar preferências</button>
          <p className="panel-footnote">As preferências ficam salvas neste navegador. Nenhum dado de autenticação é armazenado aqui.</p>
        </section>
      )}
    </div>
  );
}
