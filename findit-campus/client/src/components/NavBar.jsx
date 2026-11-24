import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

const POLL_MS = 15000;

export default function NavBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState({ pendingAsFinder: 0, unreadTotal: 0 });
  const [openReports, setOpenReports] = useState(0);

  useEffect(() => {
    if (!user) {
      setSummary({ pendingAsFinder: 0, unreadTotal: 0 });
      return;
    }
    let cancelled = false;

    function poll() {
      api
        .myClaims()
        .then((data) => {
          if (!cancelled) setSummary(data.summary);
        })
        .catch(() => {});
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  useEffect(() => {
    if (!user || !user.isAdmin) {
      setOpenReports(0);
      return;
    }
    let cancelled = false;

    function poll() {
      api
        .getAdminStats()
        .then((data) => {
          if (!cancelled) setOpenReports(data.openReports);
        })
        .catch(() => {});
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  function handleLogout() {
    logout();
    navigate('/');
  }

  const badgeCount = summary.pendingAsFinder + summary.unreadTotal;

  return (
    <nav className="navbar">
      <Link to="/" className="brand">FindIt Campus</Link>
      <div className="nav-links">
        <Link to="/">Board</Link>
        {user && <Link to="/new">+ New post</Link>}
        {user && <Link to="/mine">My posts</Link>}
        {user && (
          <Link to="/inbox">
            Inbox{badgeCount > 0 && <span className="nav-badge">{badgeCount}</span>}
          </Link>
        )}
        {user && user.isAdmin && (
          <Link to="/admin">
            Admin{openReports > 0 && <span className="nav-badge">{openReports}</span>}
          </Link>
        )}
        {user ? (
          <>
            <span className="muted">{user.name}</span>
            <button onClick={handleLogout}>Log out</button>
          </>
        ) : (
          <>
            <Link to="/login">Log in</Link>
            <Link to="/signup">Sign up</Link>
          </>
        )}
      </div>
    </nav>
  );
}
