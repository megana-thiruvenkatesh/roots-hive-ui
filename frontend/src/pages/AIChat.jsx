import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext.jsx';
import { askBuiltinModel } from '../lib/builtinModel';
import ChatAttachControl, { ChatAttachChips, formatChatAttachments } from '../components/ChatAttachControl.jsx';

export default function AIChat() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [fromKb, setFromKb] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  const firstName = (user?.name || 'there').split(/\s+/)[0];

  useEffect(() => {
    api.get('/conversations').then((data) => {
      setConversations(data.conversations || []);
      if (data.conversations?.length) setActiveId(data.conversations[0].id);
    });
    api
      .get('/kb/suggestions')
      .then((d) => {
        setSuggestions(d.suggestions || []);
        setFromKb(Boolean(d.fromKb));
      })
      .catch(() => {
        setSuggestions([
          'What are common leakage root causes in manufacturing?',
          'How should we run an 8D for a supplier complaint?',
          'What CAPA steps apply to dimensional deviation?',
          'Show me preventive actions for fitment issues',
        ]);
      });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, activeId, sending]);

  const active = conversations.find((c) => c.id === activeId);
  const messages = active?.messages || [];
  const showGreeting = !messages.length;

  async function ensureConversation() {
    if (activeId) return activeId;
    const data = await api.post('/conversations', { title: 'New Conversation' });
    setConversations((prev) => [data.conversation, ...prev]);
    setActiveId(data.conversation.id);
    return data.conversation.id;
  }

  function appendLocalMessage(convId, msg) {
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, messages: [...(c.messages || []), msg] } : c))
    );
  }

  async function newChat() {
    const data = await api.post('/conversations', { title: 'New Conversation' });
    setConversations((prev) => [data.conversation, ...prev]);
    setActiveId(data.conversation.id);
    setInput('');
    setPendingFiles([]);
    setStatusText('');
  }

  async function clearCurrent() {
    if (!activeId) {
      setInput('');
      setPendingFiles([]);
      return;
    }
    await api.del(`/conversations/${activeId}`);
    setConversations((prev) => prev.filter((c) => c.id !== activeId));
    setActiveId(null);
    setInput('');
    setPendingFiles([]);
    setStatusText('');
  }

  async function clearAll() {
    await api.del('/conversations');
    setConversations([]);
    setActiveId(null);
    setInput('');
    setPendingFiles([]);
    setStatusText('');
  }

  async function sendText(raw) {
    const text = formatChatAttachments(pendingFiles, raw);
    if (!text || sending) return;
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setPendingFiles([]);
    setSending(true);
    setStatusText('');

    const convId = await ensureConversation();
    const userMsg = { id: crypto.randomUUID(), role: 'user', text };
    appendLocalMessage(convId, userMsg);
    await api.post(`/conversations/${convId}/messages`, {
      role: 'user',
      text,
      title: text.slice(0, 40),
    });

    try {
      const result = await api.post('/ai/chat', { message: text });
      let answer = result.answer;
      let sources = result.sources || [];

      if (!result.handledServerSide) {
        const kb = await api.post('/kb/search', { query: text }).catch(() => ({ matches: [] }));
        const kbContext = kb.matches?.length
          ? kb.matches.map((m) => `[${m.source}]:\n${m.text}`).join('\n---\n')
          : '';
        try {
          setStatusText('Thinking…');
          answer = await askBuiltinModel(
            text,
            'You are HIVE AI, a manufacturing quality & CAPA assistant. Answer concisely.',
            kbContext,
            (s) => setStatusText(s.text)
          );
          sources = kb.matches?.map((m) => m.source) || [];
        } catch {
          answer = kbContext
            ? `Here's what I found in the Knowledge Base:\n\n${kbContext}`
            : "I don't have a ready answer yet. Add KB documents in Settings → Knowledge Base, or configure an AI provider.";
        }
      }

      const aiMsg = { id: crypto.randomUUID(), role: 'ai', text: answer, meta: { sources } };
      appendLocalMessage(convId, aiMsg);
      await api.post(`/conversations/${convId}/messages`, {
        role: 'ai',
        text: answer,
        meta: { sources },
      });
    } catch (e) {
      appendLocalMessage(convId, {
        id: crypto.randomUUID(),
        role: 'ai',
        text: `⚠ ${e.message}`,
      });
    } finally {
      setSending(false);
      setStatusText('');
    }
  }

  function onComposerKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendText(input);
    }
  }

  return (
    <div className="ai-chat-shell">
      <aside className="ai-chat-history">
        <button type="button" className="ai-chat-new" onClick={newChat}>
          + New Chat
        </button>

        <div className="ai-chat-history-head">
          <span>Recent Chats</span>
          <button type="button" className="ai-chat-link-btn" onClick={clearAll} disabled={!conversations.length}>
            Clear All
          </button>
        </div>

        <div className="ai-chat-history-list">
          {conversations.length === 0 ? (
            <p className="ai-chat-empty-hint">No Chats Yet</p>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`ai-chat-hist-item ${c.id === activeId ? 'active' : ''}`}
                onClick={() => setActiveId(c.id)}
              >
                <span className="ai-chat-hist-title">{c.title || 'New Conversation'}</span>
                <span className="ai-chat-hist-meta">{(c.messages || []).length} msgs</span>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className="ai-chat-stage">
        <header className="ai-chat-topbar">
          <div className="ai-chat-topbar-left">
            <strong>AI Chat</strong>
            <span>
              Ask about CAPA, defects, supplier 8D, and your knowledge base
              {fromKb ? ' · grounded in KB' : ''}
            </span>
          </div>
          <div className="ai-chat-topbar-actions">
            <button type="button" className="ai-chat-icon-btn" onClick={clearCurrent} title="Clear chat">
              Clear
            </button>
            <button type="button" className="ai-chat-icon-btn primary" onClick={newChat}>
              + New
            </button>
          </div>
        </header>

        <div className="ai-chat-body">
          {showGreeting ? (
            <div className="ai-chat-greeting">
              <div className="ai-chat-mark" style={{ border: 'none', background: 'none', boxShadow: 'none' }}>
                <img src="/logo.png" alt="Hive AI" style={{ width: 54, height: 54, objectFit: 'contain' }} />
              </div>
              <h1>Hello, {firstName}</h1>
              <p>Ask anything about quality, CAPA, and manufacturing.</p>
              {suggestions.length ? (
                <div className="ai-suggest-list" aria-label="Suggestion questions">
                  {suggestions.slice(0, 5).map((q, idx) => (
                    <button
                      key={`${q}-${idx}`}
                      type="button"
                      className="ai-suggest-card"
                      onClick={() => sendText(q)}
                    >
                      <div className="ai-suggest-text">{q}</div>
                      <div className="ai-suggest-go">→</div>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="ai-chat-messages gpt-messages">
              {messages.map((m) => (
                <div key={m.id} className={`gpt-msg ${m.role === 'user' ? 'user' : 'ai'}`}>
                  <div className="gpt-msg-text">{m.text}</div>
                  {m.meta?.sources?.length ? (
                    <div className="ai-bubble-sources">Sources: {m.meta.sources.join(', ')}</div>
                  ) : null}
                </div>
              ))}
              {sending ? <div className="gpt-msg ai thinking">Thinking…</div> : null}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <footer className="ai-chat-footer gpt-footer">
          {statusText ? <div className="ai-chat-status">{statusText}</div> : null}
          <div className="gpt-composer-wrap">
            <ChatAttachChips
              files={pendingFiles}
              onRemove={(file) =>
                setPendingFiles((current) =>
                  current.filter((entry) => !(entry.name === file.name && entry.size === file.size))
                )
              }
            />
            <div className="ai-chat-composer gpt-composer">
              <ChatAttachControl
                files={pendingFiles}
                onChange={setPendingFiles}
                disabled={sending}
              />
              <textarea
                ref={textareaRef}
                rows={1}
                placeholder="Ask anything"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
                }}
                onKeyDown={onComposerKey}
                disabled={sending}
              />
              <button
                type="button"
                className="gpt-send"
                onClick={() => sendText(input)}
                disabled={sending || (!input.trim() && !pendingFiles.length)}
                title="Send"
                aria-label="Send"
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                  <path
                    d="M12 19V5M5.5 11.5 12 5l6.5 6.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <div className="ai-chat-footnote">HIVE AI can make mistakes. Check important quality data.</div>
          </div>
        </footer>
      </section>
    </div>
  );
}
