"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";

// Render de Markdown SEGURO para la bitácora (SOL-16).
// react-markdown NO renderiza HTML crudo (no usamos rehype-raw) y sanea los
// href peligrosos (javascript:/data:) por defecto → sin inyección de HTML.
// remark-gfm agrega tablas, listas de tareas, tachado y autolinks.
const componentes: Components = {
  p: ({ children }) => <p className="my-1 first:mt-0 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-navy">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del className="text-gray-400">{children}</del>,
  h1: ({ children }) => <h1 className="mb-1 mt-2 text-base font-bold text-navy first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-1 mt-2 text-sm font-bold text-navy first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1 mt-2 text-sm font-semibold text-navy first:mt-0">{children}</h3>,
  ul: ({ children }) => <ul className="my-1 list-disc space-y-0.5 pl-5">{children}</ul>,
  ol: ({ children }) => <ol className="my-1 list-decimal space-y-0.5 pl-5">{children}</ol>,
  li: ({ children }) => <li className="leading-snug">{children}</li>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-600 hover:underline">
      {children}
    </a>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-1 border-l-2 border-surface-border pl-3 text-gray-500">{children}</blockquote>
  ),
  code: ({ children }) => (
    <code className="rounded bg-surface px-1 py-0.5 font-mono text-[0.85em] text-navy">{children}</code>
  ),
  pre: ({ children }) => (
    <pre className="my-1 overflow-x-auto rounded bg-surface p-2 font-mono text-xs">{children}</pre>
  ),
  hr: () => <hr className="my-2 border-surface-border" />,
  table: ({ children }) => (
    <div className="my-1 overflow-x-auto">
      <table className="min-w-full border-collapse text-xs">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-surface-border bg-surface px-2 py-1 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border border-surface-border px-2 py-1 align-top">{children}</td>,
};

export default function Markdown({ children }: { children: string }) {
  return (
    <div className="text-sm leading-relaxed text-gray-700">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={componentes}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
