import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import './json-editor.css';

/**
 * Plain-text JSON editor with line numbers (WEB04). Lines in `errorLines` are highlighted in
 * the gutter and behind the text, so an error reported "on line N" is easy to find.
 * The text area keeps its native editing, undo and accessibility; the gutter is decorative
 * (the line of each error is also written in the error messages).
 *
 * @param {object} props
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 * @param {number[]} [props.errorLines] - 1-based lines with an error.
 * Other props (id, aria-*) go to the text area.
 */
export default function JsonEditor({
  value,
  onChange,
  errorLines = [],
  ...input
}) {
  const { t } = useTranslation();
  const [scrollTop, setScrollTop] = useState(0);
  const lineCount = Math.max(1, value.split('\n').length);
  const errors = new Set(errorLines);

  return (
    <div className="json-editor-frame">
      <ol
        className="json-editor-gutter"
        aria-hidden="true"
        style={{ transform: `translateY(${-scrollTop}px)` }}
      >
        {Array.from({ length: lineCount }, (_, index) => (
          <li
            key={index}
            className={errors.has(index + 1) ? 'is-error' : undefined}
            title={errors.has(index + 1) ? t('json.errorOnLine') : undefined}
          >
            {index + 1}
          </li>
        ))}
      </ol>
      <div className="json-editor-body">
        <div
          className="json-editor-highlights"
          aria-hidden="true"
          style={{ transform: `translateY(${-scrollTop}px)` }}
        >
          {[...errors].map((line) => (
            <span
              key={line}
              className="json-editor-highlight"
              style={{ top: `calc(${line - 1} * var(--json-line-height))` }}
            />
          ))}
        </div>
        <textarea
          className="json-editor"
          value={value}
          wrap="off"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          onChange={(event) => onChange(event.target.value)}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          {...input}
        />
      </div>
    </div>
  );
}
