import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ExternalLink, FolderOpen } from 'lucide-react';

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({
  icon: Icon = FolderOpen,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={26} strokeWidth={1.5} />
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}

export function Tags({ items }: { items: string[] }) {
  return (
    <div className="tags">
      {items.map((item) => (
        <span className="tag" key={item}>
          {item}
        </span>
      ))}
    </div>
  );
}

export function ExternalLinkButton({ href, children }: { href: string; children: ReactNode }) {
  if (!/^https?:\/\//i.test(href)) return null;
  return (
    <a className="text-link" href={href} target="_blank" rel="noopener noreferrer">
      {children}
      <ExternalLink size={13} />
      <span className="sr-only"> (새 탭)</span>
    </a>
  );
}
