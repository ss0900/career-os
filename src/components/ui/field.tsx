import type { InputHTMLAttributes, ReactNode } from 'react';

export function RequiredMark() {
  return (
    <span className="required" aria-hidden="true">
      {' '}
      *
    </span>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  multiline?: boolean;
};
export function Field({ label, name, error, hint, multiline, required, ...props }: FieldProps) {
  const id = `field-${name}`;
  const shared = {
    id,
    name,
    required,
    'aria-invalid': !!error,
    'aria-describedby': error ? `${id}-error` : hint ? `${id}-hint` : undefined,
    className: 'input',
    defaultValue: props.defaultValue,
    placeholder: props.placeholder,
    maxLength: props.maxLength ?? 12000,
  };
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {required && <RequiredMark />}
      </label>
      {multiline ? <textarea {...shared} rows={4} /> : <input {...props} {...shared} />}
      {hint && (
        <p className="field-hint" id={`${id}-hint`}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  name,
  label,
  defaultValue,
  children,
  onChange,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  children: ReactNode;
  onChange?: (value: string) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={`field-${name}`}>{label}</label>
      <select
        id={`field-${name}`}
        name={name}
        className="input"
        defaultValue={defaultValue}
        onChange={(event) => onChange?.(event.target.value)}
      >
        {children}
      </select>
    </div>
  );
}
