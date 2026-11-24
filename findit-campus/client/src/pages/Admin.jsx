import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

export default function Admin() {
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState([]);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    Promise.all([api.getAdminStats(), api.listAdminReports()])
      .then(([statsData, reportsData]) => {
        setStats(statsData);
        setReports(reportsData.reports);
      })
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleResolve(id, status) {
    setBusyId(id);
    setError('');
    try {
      await api.updateReportStatus(id, status);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeletePost(postId) {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    setBusyId(`post-${postId}`);
    setError('');
    try {
      await api.adminDeletePost(postId);
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h2>Admin dashboard</h2>
      {error && <p className="error">{error}</p>}

      {stats && (
        <div className="admin-stats">
          <div className="stat-tile"><strong>{stats.totalUsers}</strong><span>Users</span></div>
          <div className="stat-tile"><strong>{stats.totalPosts}</strong><span>Posts</span></div>
          <div className="stat-tile"><strong>{stats.openPosts}</strong><span>Open</span></div>
          <div className="stat-tile"><strong>{stats.claimedPosts}</strong><span>Claimed</span></div>
          <div className="stat-tile"><strong>{stats.resolvedPosts}</strong><span>Resolved</span></div>
          <div className="stat-tile"><strong>{stats.openReports}</strong><span>Open reports</span></div>
        </div>
      )}

      <h3>Reports</h3>
      {reports.length === 0 ? (
        <p className="muted">No reports have been filed.</p>
      ) : (
        <ul className="claims-list">
          {reports.map((r) => (
            <li key={r.id} className="claim-review-item">
              <div>
                <span className={`status-pill status-${r.status.toLowerCase()}`}>{r.status}</span>{' '}
                <strong>{r.targetType}</strong>:{' '}
                {r.targetType === 'POST' && !r.target.deleted ? (
                  <Link to={`/posts/${r.targetId}`}>{r.target.label}</Link>
                ) : (
                  <span>{r.target.label}</span>
                )}
              </div>
              <p className="muted">Reported by {r.reporter.name} — "{r.reason}"</p>
              {r.status === 'OPEN' && (
                <div className="claim-actions">
                  <button onClick={() => handleResolve(r.id, 'RESOLVED')} disabled={busyId === r.id}>
                    Resolve (valid)
                  </button>
                  <button
                    onClick={() => handleResolve(r.id, 'DISMISSED')}
                    disabled={busyId === r.id}
                    className="danger"
                  >
                    Dismiss
                  </button>
                  {r.targetType === 'POST' && !r.target.deleted && (
                    <button
                      onClick={() => handleDeletePost(r.targetId)}
                      disabled={busyId === `post-${r.targetId}`}
                      className="danger"
                    >
                      Delete post
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
