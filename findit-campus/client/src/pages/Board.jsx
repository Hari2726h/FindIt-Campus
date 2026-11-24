import { useEffect, useState } from 'react';
import { api } from '../api/client';
import PostCard from '../components/PostCard';
import { CATEGORIES } from '../constants';
import { useDebouncedValue } from '../hooks/useDebouncedValue';

const DEFAULT_FILTERS = { type: '', q: '', category: '', location: '', from: '', to: '', sort: 'newest' };

export default function Board() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const debouncedQ = useDebouncedValue(filters.q, 300);
  const debouncedLocation = useDebouncedValue(filters.location, 300);

  function setField(field, value) {
    setFilters((f) => ({ ...f, [field]: value }));
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .listPosts({
        type: filters.type,
        category: filters.category,
        from: filters.from,
        to: filters.to,
        sort: filters.sort,
        q: debouncedQ,
        location: debouncedLocation,
      })
      .then((data) => {
        // Rapidly switching tabs/filters fires overlapping requests; an
        // earlier one can resolve after a later one if the network happens
        // to reorder them. `cancelled` (set by this effect's own cleanup,
        // which React runs before the next effect) makes a stale response
        // a no-op instead of overwriting the list that matches what's
        // currently selected.
        if (!cancelled) setPosts(data.posts);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [filters.type, filters.category, filters.from, filters.to, filters.sort, debouncedQ, debouncedLocation]);

  const hasActiveFilters = Object.keys(DEFAULT_FILTERS).some(
    (key) => key !== 'sort' && filters[key] !== DEFAULT_FILTERS[key]
  );

  return (
    <div>
      <div className="tabs">
        <button className={filters.type === '' ? 'active' : ''} onClick={() => setField('type', '')}>All</button>
        <button className={filters.type === 'LOST' ? 'active' : ''} onClick={() => setField('type', 'LOST')}>Lost</button>
        <button className={filters.type === 'FOUND' ? 'active' : ''} onClick={() => setField('type', 'FOUND')}>Found</button>
      </div>

      <div className="filters">
        <input
          placeholder="Search title/description"
          value={filters.q}
          onChange={(e) => setField('q', e.target.value)}
        />
        <select value={filters.category} onChange={(e) => setField('category', e.target.value)}>
          <option value="">All categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input
          placeholder="Location"
          value={filters.location}
          onChange={(e) => setField('location', e.target.value)}
        />
      </div>

      <div className="filters">
        <label className="inline-label">From
          <input type="date" value={filters.from} onChange={(e) => setField('from', e.target.value)} />
        </label>
        <label className="inline-label">To
          <input type="date" value={filters.to} onChange={(e) => setField('to', e.target.value)} />
        </label>
        <select value={filters.sort} onChange={(e) => setField('sort', e.target.value)}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
        {hasActiveFilters && (
          <button type="button" className="link-button" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Clear filters
          </button>
        )}
      </div>

      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="muted">Loading posts...</p>
      ) : posts.length === 0 ? (
        <p className="muted">No posts match yet. Try clearing filters or be the first to post one!</p>
      ) : (
        <div className="post-grid">
          {posts.map((post) => <PostCard key={post.id} post={post} />)}
        </div>
      )}
    </div>
  );
}
