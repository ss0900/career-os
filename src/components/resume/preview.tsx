import { useEffect, useMemo, useRef, useState } from 'react';
import type { ResumeDocument } from '../../data/resume-schema';
import { buildResumeBlocks, paginateBlocks, type ResumeBlock } from '../../data/resume-layout';
import '@fontsource/noto-sans-kr/400.css';
import '@fontsource/noto-sans-kr/700.css';
import './resume.css';

function Block({ block }: { block: ResumeBlock }) {
  const className = `resume-block resume-${block.kind}`;
  if (block.kind === 'name') return <h1 className={className}>{block.text}</h1>;
  if (block.kind === 'section') return <h2 className={className}>{block.text}</h2>;
  if (block.kind === 'entry') return <h3 className={className}>{block.text}</h3>;
  if (block.kind === 'link')
    return (
      <p className={className}>
        <a href={block.href} target="_blank" rel="noopener noreferrer">
          {block.text}
        </a>
      </p>
    );
  return <p className={className}>{block.text}</p>;
}

export function ResumePreview({
  document,
  zoom = 0.65,
  onLayout,
}: {
  document: ResumeDocument;
  zoom?: number;
  onLayout?: (key: string) => void;
}) {
  const measure = useRef<HTMLDivElement>(null);
  const key = JSON.stringify(document);
  const blocks = useMemo(() => buildResumeBlocks(document), [document]);
  const [layout, setLayout] = useState<{ key: string; pages: ResumeBlock[][] }>({
    key: '',
    pages: [],
  });
  useEffect(() => {
    let cancelled = false;
    const element = measure.current;
    if (!element) return;
    const calculate = () => {
      if (cancelled) return;
      if (!element.getBoundingClientRect().width) return;
      const heights = [...element.children].map((node) => node.getBoundingClientRect().height);
      const capacity = (element.getBoundingClientRect().width * 255) / 178 - 2;
      setLayout({ key, pages: paginateBlocks(blocks, heights, capacity) });
      onLayout?.(key);
    };
    // Measure with the same self-hosted Korean font used in the printed pages.
    void window.document.fonts.ready.then(calculate);
    const observer = new ResizeObserver(() => {
      void window.document.fonts.ready.then(calculate);
    });
    observer.observe(element);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [blocks, key, onLayout]);
  const pages = layout.key === key ? layout.pages : [];
  return (
    <div className="resume-preview" data-ready={layout.key === key}>
      <div ref={measure} className="resume-measure resume-typography" aria-hidden="true">
        {blocks.map((block) => (
          <Block key={block.id} block={block} />
        ))}
      </div>
      {layout.key !== key && (
        <p className="muted preview-loading" role="status">
          A4 페이지를 계산하고 있습니다…
        </p>
      )}
      <div className="resume-pages" style={{ zoom }}>
        {pages.map((page, index) => (
          <article
            className="resume-page resume-typography"
            aria-label={`이력서 ${index + 1}페이지`}
            key={index}
          >
            <div className="resume-page-body">
              {page.map((block) => (
                <Block key={block.id} block={block} />
              ))}
            </div>
            <footer className="resume-page-footer">
              {index + 1} / {pages.length}
            </footer>
          </article>
        ))}
      </div>
      <p className="preview-page-count" aria-live="polite">
        A4 · {pages.length}페이지
      </p>
    </div>
  );
}
