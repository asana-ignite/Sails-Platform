import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import './Toast.css';

export type ToastTone = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
  durationMs?: number;
}

interface ToastContextValue {
  toast: {
    success: (message: string, durationMs?: number) => void;
    error: (message: string, durationMs?: number) => void;
    warning: (message: string, durationMs?: number) => void;
    info: (message: string, durationMs?: number) => void;
    show: (message: string, tone?: ToastTone, durationMs?: number) => void;
  };
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idSeq = useRef(0);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback((message: string, tone: ToastTone = 'success', durationMs = 4000) => {
    idSeq.current += 1;
    const id = `toast_${Date.now()}_${idSeq.current}`;
    const newToast: ToastItem = { id, message, tone, durationMs };

    setToasts((prev) => [...prev.slice(-4), newToast]); // keep at most 5 toasts visible

    if (durationMs > 0) {
      setTimeout(() => {
        removeToast(id);
      }, durationMs);
    }
  }, [removeToast]);

  const toast = React.useMemo(() => ({
    success: (msg: string, dur?: number) => show(msg, 'success', dur),
    error: (msg: string, dur?: number) => show(msg, 'error', dur || 6000),
    warning: (msg: string, dur?: number) => show(msg, 'warning', dur || 5000),
    info: (msg: string, dur?: number) => show(msg, 'info', dur),
    show,
  }), [show]);

  const getIcon = (tone: ToastTone) => {
    switch (tone) {
      case 'success': return <CheckCircle2 size={18} className="sails-toast__icon sails-toast__icon--success" />;
      case 'error': return <XCircle size={18} className="sails-toast__icon sails-toast__icon--error" />;
      case 'warning': return <AlertTriangle size={18} className="sails-toast__icon sails-toast__icon--warning" />;
      case 'info':
      default:
        return <Info size={18} className="sails-toast__icon sails-toast__icon--info" />;
    }
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {typeof document !== 'undefined' && createPortal(
        <div className="sails-toast-container" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`sails-toast sails-toast--${t.tone}`}>
              {getIcon(t.tone)}
              <span className="sails-toast__msg">{t.message}</span>
              <button
                type="button"
                className="sails-toast__close"
                onClick={() => removeToast(t.id)}
                title="Dismiss"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return ctx;
};
