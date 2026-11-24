import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

const POLL_MS = 4000;

export default function Chat() {
  const { claimId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    let timer;

    async function poll() {
      try {
        const data = await api.listMessages(claimId);
        if (!cancelled) {
          setMessages(data.messages);
          setError('');
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) {
          setLoading(false);
          timer = setTimeout(poll, POLL_MS);
        }
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [claimId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e) {
    e.preventDefault();
    const toSend = text.trim();
    if (!toSend || sending) return;
    setSending(true);
    setError('');
    try {
      await api.sendMessage(claimId, toSend);
      // Only clear the input once the send actually succeeds — clearing it
      // up front meant a rejected message (profanity filter, a dropped
      // request) silently discarded whatever the user had typed.
      setText('');
      const data = await api.listMessages(claimId);
      setMessages(data.messages);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="card chat-card">
      <button type="button" className="link-button" onClick={() => navigate(-1)}>&larr; Back</button>
      <h2>Chat</h2>
      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="muted">Loading messages...</p>
      ) : (
        <div className="chat-messages">
          {messages.length === 0 && (
            <p className="muted">No messages yet — say hello and arrange a handover.</p>
          )}
          {messages.map((m) => (
            <div key={m.id} className={`chat-bubble ${m.senderId === user.id ? 'mine' : ''}`}>
              <p>{m.text}</p>
              <span className="chat-time">
                {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}
      <form onSubmit={handleSend} className="chat-form">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message..."
          disabled={sending}
        />
        <button type="submit" disabled={sending}>{sending ? 'Sending...' : 'Send'}</button>
      </form>
    </div>
  );
}
