import { Link } from 'react-router-dom';

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

export default function PostCard({ post }) {
  return (
    <Link to={`/posts/${post.id}`} className="post-card">
      <div className="post-card-image">
        {post.images[0] ? (
          <img src={post.images[0]} alt={post.title} />
        ) : (
          <div className="post-card-placeholder">no photo</div>
        )}
      </div>
      <div className="post-card-body">
        <span className={`badge badge-${post.type.toLowerCase()}`}>{post.type}</span>
        <h3>{post.title}</h3>
        <p className="muted">
          {post.category} · {timeAgo(post.dateEvent)} · {post.locationText}
        </p>
      </div>
    </Link>
  );
}
