import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { errorMessage } from '../../lib/utils';
import { Button } from './button';

export function Dialog({
  title,
  description,
  children,
  onClose,
  wide = false,
  canClose = true,
}: {
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  canClose?: boolean;
}) {
  return (
    <DialogPrimitive.Root
      open
      onOpenChange={(open) => {
        if (!open && canClose) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="dialog-overlay" />
        <DialogPrimitive.Content
          className={`dialog-content ${wide ? 'dialog-wide' : ''}`}
          onPointerDownOutside={(event) => event.preventDefault()}
        >
          <div className="dialog-header">
            <div>
              <DialogPrimitive.Title>{title}</DialogPrimitive.Title>
              <DialogPrimitive.Description>{description}</DialogPrimitive.Description>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="닫기"
              onClick={onClose}
              disabled={!canClose}
            >
              <X size={20} />
            </Button>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel = '삭제',
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function confirm() {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
      setBusy(false);
    }
  }
  return (
    <Dialog title={title} description={description} onClose={onClose} canClose={!busy}>
      {error && (
        <p role="alert" className="alert error">
          {error}
        </p>
      )}
      <div className="dialog-footer">
        <Button variant="outline" disabled={busy} onClick={onClose}>
          취소
        </Button>
        <Button variant="destructive" disabled={busy} onClick={() => void confirm()}>
          {busy ? '처리 중…' : confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
