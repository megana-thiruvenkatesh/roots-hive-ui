import React, { useRef } from 'react';

export const CHAT_ATTACH_ACCEPT =
  'image/*,.pdf,.doc,.docx,.txt,.csv,.xlsx,.xls,.ppt,.pptx,.md';

export function formatChatAttachments(files, text) {
  if (!files?.length) return String(text || '').trim();
  const lines = files.map((file) => {
    const kind = String(file.type || '').startsWith('image/') ? 'Image' : 'Document';
    return `[${kind} attached: ${file.name}]`;
  });
  return `${String(text || '').trim() || 'Please review the attached file(s) and respond.'}\n${lines.join('\n')}`;
}

export function ChatAttachButton() {
  return (
    <svg className="ai-attach-plus" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        d="M12 5v14M5 12h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function ChatAttachControl({
  files = [],
  onChange,
  disabled = false,
  className = 'ai-attach-btn',
}) {
  const inputRef = useRef(null);

  function addFiles(list) {
    const incoming = Array.from(list || []);
    if (!incoming.length) return;
    const next = [...files];
    incoming.forEach((file) => {
      if (!next.some((existing) => existing.name === file.name && existing.size === file.size)) {
        next.push(file);
      }
    });
    onChange(next);
  }

  return (
    <>
      <button
        type="button"
        className={className}
        disabled={disabled}
        title="Attach images or documents"
        aria-label="Attach images or documents"
        onClick={() => inputRef.current?.click()}
      >
        <ChatAttachButton />
      </button>
      <input
        ref={inputRef}
        type="file"
        hidden
        multiple
        accept={CHAT_ATTACH_ACCEPT}
        disabled={disabled}
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </>
  );
}

export function ChatAttachChips({ files = [], onRemove }) {
  if (!files.length) return null;
  return (
    <div className="ai-attach-chips">
      {files.map((file) => {
        const isImage = String(file.type || '').startsWith('image/');
        return (
          <span key={`${file.name}-${file.size}`} className="ai-attach-chip">
            <span className="ai-attach-chip-kind">{isImage ? 'IMG' : 'DOC'}</span>
            <span className="ai-attach-chip-name" title={file.name}>
              {file.name}
            </span>
            <button
              type="button"
              className="ai-attach-chip-remove"
              title="Remove"
              aria-label={`Remove ${file.name}`}
              onClick={() => onRemove(file)}
            >
              ×
            </button>
          </span>
        );
      })}
    </div>
  );
}
