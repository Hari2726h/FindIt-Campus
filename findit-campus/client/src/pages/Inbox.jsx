import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export default function Inbox() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.myClaims().then(setData).catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Loading...</p>;

  return (
    <div>
      <h2>Inbox</h2>

      <h3>Claims I've made</h3>
      {data.asClaimant.length === 0 ? (
        <p className="muted">You haven't claimed anything yet.</p>
      ) : (
        <ul className="inbox-list">
          {data.asClaimant.map((c) => (
            <li key={c.id}>
              <Link to={`/posts/${c.post.id}`}>{c.post.title}</Link>
              <span className={`status-pill status-${c.status.toLowerCase()}`}>{c.status}</span>
              {c.hasConversation && (
                <Link to={`/chat/${c.id}`} className="chat-link">
                  Chat{c.unread > 0 && <span className="unread-dot">{c.unread}</span>}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}

      <h3>Claims on my found items</h3>
      {data.asFinder.length === 0 ? (
        <p className="muted">No one has claimed your found items yet.</p>
      ) : (
        <ul className="inbox-list">
          {data.asFinder.map((c) => (
            <li key={c.id}>
              <Link to={`/posts/${c.post.id}`}>{c.post.title}</Link>
              <span className="muted">claimed by {c.claimant.name}</span>
              <span className={`status-pill status-${c.status.toLowerCase()}`}>{c.status}</span>
              {c.hasConversation && (
                <Link to={`/chat/${c.id}`} className="chat-link">
                  Chat{c.unread > 0 && <span className="unread-dot">{c.unread}</span>}
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
