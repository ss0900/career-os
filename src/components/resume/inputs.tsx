import { useId, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Button } from '../ui/button';

export function ResumeInput({
  label,
  value,
  onChange,
  multiline = false,
  type = 'text',
  maxLength = 12000,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  type?: string;
  maxLength?: number;
  hint?: string;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea
          id={id}
          className="input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={3}
          maxLength={maxLength}
        />
      ) : (
        <input
          id={id}
          className="input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={type}
          maxLength={maxLength}
        />
      )}
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
export function ResumeCheck({
  children,
  checked,
  onChange,
}: {
  children: ReactNode;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="checkbox-label">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {children}
    </label>
  );
}
export function ResumeListInput({
  label,
  values,
  onChange,
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  const [typing, setTyping] = useState<string | null>(null);
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea
        id={id}
        className="input"
        rows={3}
        value={typing ?? values.join('\n')}
        onChange={(event) => {
          setTyping(event.target.value);
          onChange(
            event.target.value
              .split('\n')
              .map((item) => item.trim())
              .filter(Boolean),
          );
        }}
        onBlur={() => setTyping(null)}
      />
      <p className="field-hint">한 줄에 하나씩 입력하세요. 항목당 200자, 최대 100개입니다.</p>
    </div>
  );
}
export function OrderButtons({
  label,
  index,
  length,
  move,
}: {
  label: string;
  index: number;
  length: number;
  move: (direction: number) => void;
}) {
  return (
    <div className="row-actions">
      <Button
        size="icon"
        variant="ghost"
        disabled={index === 0}
        aria-label={`${label} 위로`}
        onClick={() => move(-1)}
      >
        <ArrowUp size={14} />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        disabled={index === length - 1}
        aria-label={`${label} 아래로`}
        onClick={() => move(1)}
      >
        <ArrowDown size={14} />
      </Button>
    </div>
  );
}
