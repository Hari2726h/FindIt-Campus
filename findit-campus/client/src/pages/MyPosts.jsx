import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export default function MyPosts() {
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  function refresh() {
    api.myPosts().then((data) => setPosts(data.posts)).catch((err) => setError(err.message));
  }

  useEffect(refresh, []);

  async function handleDelete(id) {
    if (!window.confirm('Delete this post?')) return;
    setBusyId(id);
    setError('');
    try {
      await api.deletePost(id);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h2>My posts</h2>
      {error && <p className="error">{error}</p>}
      {posts.length === 0 ? (
        <p className="muted">You haven't posted anything yet.</p>
      ) : (
        <ul className="my-posts-list">
          {posts.map((post) => (
            <li key={post.id}>
              <Link to={`/posts/${post.id}`}>{post.title}</Link>
              <span className="muted"> — {post.type.toLowerCase()}, {post.status.toLowerCase()}</span>
              <button
                className="danger small"
                onClick={() => handleDelete(post.id)}
                disabled={busyId === post.id}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
