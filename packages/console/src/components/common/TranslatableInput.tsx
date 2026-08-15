/**
 * TranslatableInput — a text input for user-authored labels with a globe
 * badge that opens a per-locale popover (all SUPPORTED_LOCALES).
 *
 * Value model (LocalizedText from @sails/shared):
 *   - plain string  = legacy single-language (acts as the default/'en'),
 *   - object        = { locale: text } translations.
 * The input shows the resolved text for the ACTIVE console locale (falling
 * back to the default/'en' text in a muted style). Typing while the active
 * locale has no entry creates one; clearing all non-default entries collapses
 * the value back to a plain string.
 */
import React, { useRef, useState, useMemo } from 'react';
import { Languages, X, Check } from 'lucide-react';
import { SUPPORTED_LOCALES, isLocalized, localize, localizedTextFor, setLocalizedText, hasTranslations, DEFAULT_LOCALE, type LocalizedText } from '@sails/shared';
import SailsPopover from './SailsPopover';
import { useI18nLocale } from '../../contexts/I18nContext';
import './TranslatableInput.css';

interface TranslatableInputProps {
  value: LocalizedText | null | undefined;
  onChange: (value: LocalizedText) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md';
}

export const TranslatableInput: React.FC<TranslatableInputProps> = ({
  value, onChange, placeholder, disabled, className = '', size = 'md',
}) => {
  const { locale } = useI18nLocale();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement | null>(null);

  const resolved = localize(value, locale);
  const missingForLocale = !isLocalized(value) || !localizedTextFor(value, locale);
  const hasTrans = hasTranslations(value);

  const isObject = isLocalized(value);
  const defaultText = isObject ? localizedTextFor(value, DEFAULT_LOCALE) : (typeof value === 'string' ? value : '');

  const commitLocale = (l: string, text: string) => {
    onChange(setLocalizedText(value, l, text));
  };

  const locales = useMemo(() => SUPPORTED_LOCALES, []);

  return (
    <div className={`tl-input tl-input--${size} ${className}`}>
      <div className="tl-input__field" ref={triggerRef}>
        <input
          type="text"
          className={`sails-input ${missingForLocale ? 'tl-input__input--fallback' : ''}`}
          value={resolved}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => commitLocale(locale, e.target.value)}
        />
        <button
          type="button"
          className={`tl-input__globe ${hasTrans ? 'tl-input__globe--translated' : ''} ${open ? 'tl-input__globe--open' : ''}`}
          title={hasTrans ? 'Translations available — click to edit' : 'Add translations — click to edit'}
          disabled={disabled}
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        >
          <Languages size={13} />
          {hasTrans && <span className="tl-input__dot" />}
        </button>
      </div>

      <SailsPopover
        open={open}
        triggerRef={triggerRef}
        gap={6}
        align="right"
        onClose={() => setOpen(false)}
      >
        <div className="tl-pop" onClick={(e) => e.stopPropagation()}>
          <div className="tl-pop__head">
            <Languages size={12} />
            <span>Translations</span>
          </div>
          {locales.map((l) => {
            const text = localizedTextFor(value, l.code);
            const isDefault = l.code === DEFAULT_LOCALE;
            return (
              <div key={l.code} className="tl-pop__row">
                <span className="tl-pop__lang">{l.nativeLabel}</span>
                <input
                  className="sails-input"
                  value={isDefault ? defaultText : text}
                  placeholder={isDefault ? 'Default language' : '—'}
                  onChange={(e) => commitLocale(l.code, e.target.value)}
                />
                {!isDefault && text.trim() !== '' && (
                  <button
                    type="button"
                    className="tl-pop__clear"
                    title="Clear translation"
                    onClick={() => commitLocale(l.code, '')}
                  >
                    <X size={11} />
                  </button>
                )}
                {!isDefault && text.trim() !== '' && <Check size={12} className="tl-pop__ok" />}
              </div>
            );
          })}
          <div className="tl-pop__hint">The current console language is <strong>{locale}</strong>. Missing languages fall back to the default / first available.</div>
        </div>
      </SailsPopover>
    </div>
  );
};

export default TranslatableInput;
