'use client';

import { useMemo } from 'react';

interface JsonPreviewProps {
  data: unknown;
  className?: string;
}

function colorize(json: string): string {
  return json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = 'json-number';
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? 'json-key' : 'json-string';
        } else if (/true|false/.test(match)) {
          cls = 'json-bool';
        } else if (/null/.test(match)) {
          cls = 'json-null';
        }
        return `<span class="${cls}">${match}</span>`;
      }
    );
}

export function JsonPreview({ data, className = '' }: JsonPreviewProps) {
  const highlighted = useMemo(() => {
    try {
      const str = JSON.stringify(data, null, 2);
      return colorize(str);
    } catch {
      return 'Invalid JSON';
    }
  }, [data]);

  return (
    <div
      className={`rounded-xl overflow-auto ${className}`}
      style={{
        background: 'rgba(0,0,0,0.4)',
        border: '1px solid rgba(255,255,255,0.06)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <pre
        className="p-4 text-xs leading-relaxed overflow-auto"
        style={{ fontFamily: 'JetBrains Mono, monospace' }}
        dangerouslySetInnerHTML={{ __html: highlighted }}
      />
    </div>
  );
}
