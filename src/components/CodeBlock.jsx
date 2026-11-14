import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

export default function CodeBlock({ label, language = 'javascript', code }) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="code-block">
      <div className="code-topline">
        <div className="code-file-label"><span className="code-dot" />{label}</div>
        <div className="code-tools">
          <span>{language}</span>
          <button className="copy-button" type="button" onClick={copyCode} aria-label={`Copiar código de ${label}`}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </div>
      <pre tabIndex="0" aria-label={`Exemplo didático em ${language}`}><code>{code}</code></pre>
      <div className="code-note">EXEMPLO DIDÁTICO · Não é executado nesta documentação. Substitua os valores de exemplo no seu próprio projeto.</div>
    </div>
  );
}
