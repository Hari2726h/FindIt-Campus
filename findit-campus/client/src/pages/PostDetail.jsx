import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import PostCard from '../components/PostCard';
import ReportButton from '../components/ReportButton';

export default function PostDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [post, setPost] = useState(null);
  const [error, setError] = useState('');

  const [matches, setMatches] = useState([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [matchesError, setMatchesError] = useState('');

  // claimant-side state
  const [myClaim, setMyClaim] = useState(null);
  const [maxAttempts, setMaxAttempts] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [claimBusy, setClaimBusy] = useState(false);
  const [claimError, setClaimError] = useState('');

  // finder-side review state
  const [reviewData, setReviewData] = useState(null);
  const [reviewError, setReviewError] = useState('');
  const [reviewBusyId, setReviewBusyId] = useState(null);

  // owner actions (delete / mark resolved)
  const [actionBusy, setActionBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  const loadPost = useCallback(() => {
    return api.getPost(id).then((data) => setPost(data.post)).catch((err) => setError(err.message));
  }, [id]);

  // Reset every piece of per-post state when navigating between posts (e.g.
  // clicking from one PostCard to another keeps this component mounted —
  // React Router doesn't remount it just because the :id param changed).
  // Previously only `post`/`error` were reset here, so claim status, review
  // data, and in-flight form text from the PREVIOUS post could render for a
  // moment (or, for an owner with pending claims on multiple posts, a stale
  // claim id could end up behind a Confirm/Reject button for the wrong post).
  useEffect(() => {
    setPost(null);
    setError('');
    setMatches([]);
    setMatchesError('');
    setMyClaim(null);
    setMaxAttempts(null);
    setAnswerText('');
    setClaimError('');
    setReviewData(null);
    setReviewError('');
    setActionError('');
    loadPost();
  }, [id, loadPost]);

  const isOwner = Boolean(user && post && post.owner && user.id === post.owner.id);
  const isClaimable = Boolean(user && post && post.type === 'FOUND' && !isOwner);

  useEffect(() => {
    if (!isOwner || !post || post.status !== 'OPEN') {
      setMatches([]);
      return;
    }
    setMatchesLoading(true);
    setMatchesError('');
    api
      .getMatches(id)
      .then((data) => setMatches(data.matches))
      .catch((err) => setMatchesError(err.message))
      .finally(() => setMatchesLoading(false));
  }, [id, isOwner, post]);

  const loadMyClaim = useCallback(() => {
    if (!isClaimable) return;
    api
      .getMyClaimForPost(id)
      .then((data) => {
        setMyClaim(data.claim);
        setMaxAttempts(data.maxAttempts);
      })
      .catch((err) => setClaimError(err.message));
  }, [id, isClaimable]);

  useEffect(() => {
    loadMyClaim();
  }, [loadMyClaim]);

  const loadReview = useCallback(() => {
    if (!isOwner || !post || post.type !== 'FOUND') return;
    api.listClaimsForPost(id).then(setReviewData).catch((err) => setReviewError(err.message));
  }, [id, isOwner, post]);

  useEffect(() => {
    loadReview();
  }, [loadReview]);

  async function handleDelete() {
    if (!window.confirm('Delete this post?')) return;
    setActionBusy(true);
    setActionError('');
    try {
      await api.deletePost(id);
      navigate('/mine');
    } catch (err) {
      setActionError(err.message);
      setActionBusy(false);
    }
  }

  async function handleMarkResolved() {
    setActionBusy(true);
    setActionError('');
    try {
      await api.markResolved(id);
      await loadPost();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionBusy(false);
    }
  }

  async function handleSubmitClaim(e) {
    e.preventDefault();
    setClaimError('');
    setClaimBusy(true);
    try {
      await api.claimPost(id, answerText);
      setAnswerText('');
      loadMyClaim();
    } catch (err) {
      setClaimError(err.message);
    } finally {
      setClaimBusy(false);
    }
  }

  async function handleConfirm(claimId) {
    setReviewBusyId(claimId);
    setReviewError('');
    try {
      await api.confirmClaim(claimId);
      await Promise.all([loadReview(), loadPost()]);
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setReviewBusyId(null);
    }
  }

  async function handleReject(claimId) {
    setReviewBusyId(claimId);
    setReviewError('');
    try {
      await api.rejectClaim(claimId);
      await loadReview();
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setReviewBusyId(null);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!post) return <p className="muted">Loading...</p>;

  const attemptsExhausted = Boolean(maxAttempts && myClaim && myClaim.attemptsUsed >= maxAttempts);

  return (
    <div>
      <div className="card post-detail">
        {post.images.length > 0 && (
          <div className="post-gallery">
            {post.images.map((src) => <img key={src} src={src} alt={post.title} />)}
          </div>
        )}
        <span className={`badge badge-${post.type.toLowerCase()}`}>{post.type}</span>
        <h2>{post.title}</h2>
        <p className="muted">
          {post.category} · {new Date(post.dateEvent).toLocaleDateString()} · {post.locationText} · status: {post.status}
        </p>
        {post.owner && (
          <p className="muted">
            Posted by {post.owner.name}
            {typeof post.owner.trustScore === 'number' && ` (trust: ${post.owner.trustScore})`}
          </p>
        )}
        <p>{post.description}</p>

        {user && !isOwner && (
          <ReportButton targetType="POST" targetId={post.id} label="Report this post" />
        )}

        {post.type === 'FOUND' && post.verificationQuestion && !isOwner && (
          <div className="verification-box">
            <h4>Verification question</h4>
            <p>"{post.verificationQuestion}"</p>

            {!user ? (
              <p className="muted"><Link to="/login">Log in</Link> to claim this item.</p>
            ) : myClaim && myClaim.status === 'CONFIRMED' ? (
              <div>
                <p className="claim-status claim-confirmed">Confirmed — this item is yours!</p>
                <Link to={`/chat/${myClaim.id}`}>Open chat with the finder</Link>
              </div>
            ) : post.status !== 'OPEN' ? (
              <p className="muted">This item has already been claimed by someone else.</p>
            ) : (
              <>
                {myClaim && (
                  <div className="claim-history">
                    <p className={`claim-status claim-${myClaim.status.toLowerCase()}`}>
                      Status: {myClaim.status}
                      {maxAttempts != null && ` — ${myClaim.attemptsUsed}/${maxAttempts} attempts used`}
                    </p>
                    <ul>
                      {myClaim.attempts.map((a) => (
                        <li key={a.id} className="muted">You answered: "{a.answerText}"</li>
                      ))}
                    </ul>
                  </div>
                )}
                {claimError && <p className="error">{claimError}</p>}
                {attemptsExhausted ? (
                  <p className="muted">You've used all your attempts for this item.</p>
                ) : (
                  <form onSubmit={handleSubmitClaim} className="claim-form">
                    <input
                      required
                      placeholder="Your answer"
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                    />
                    <button type="submit" disabled={claimBusy}>
                      {claimBusy ? 'Submitting...' : 'This is mine'}
                    </button>
                  </form>
                )}
              </>
            )}
          </div>
        )}

        {isOwner && (
          <div className="owner-actions">
            {actionError && <p className="error">{actionError}</p>}
            {post.status !== 'RESOLVED' && (
              <button onClick={handleMarkResolved} disabled={actionBusy}>
                {actionBusy ? 'Working...' : 'Mark as resolved'}
              </button>
            )}
            {post.status !== 'CLAIMED' && (
              <button onClick={handleDelete} className="danger" disabled={actionBusy}>
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      {isOwner && post.type === 'FOUND' && reviewData && (
        <div className="matches-section">
          <h3>Claims on this item</h3>
          {reviewData.question && (
            <p className="muted">
              Question: "{reviewData.question}" — your answer: <strong>{reviewData.secretAnswer}</strong>
            </p>
          )}
          {reviewError && <p className="error">{reviewError}</p>}
          {reviewData.claims.length === 0 ? (
            <p className="muted">No claims yet.</p>
          ) : (
            <ul className="claims-list">
              {reviewData.claims.map((c) => (
                <li key={c.id} className="claim-review-item">
                  <div>
                    <strong>{c.claimant.name}</strong>{' '}
                    <span className={`status-pill status-${c.status.toLowerCase()}`}>{c.status}</span>{' '}
                    <ReportButton targetType="USER" targetId={c.claimant.id} label="Report claimant" />
                  </div>
                  <ul>
                    {c.attempts.map((a) => <li key={a.id}>"{a.answerText}"</li>)}
                  </ul>
                  {c.status === 'PENDING' && (
                    <div className="claim-actions">
                      <button onClick={() => handleConfirm(c.id)} disabled={reviewBusyId === c.id}>
                        Confirm match
                      </button>
                      <button
                        onClick={() => handleReject(c.id)}
                        disabled={reviewBusyId === c.id}
                        className="danger"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                  {c.status === 'CONFIRMED' && c.hasConversation && (
                    <Link to={`/chat/${c.id}`}>Open chat</Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {isOwner && post.status === 'OPEN' && (
        <div className="matches-section">
          <h3>Possible matches</h3>
          <p className="muted">
            Automatically suggested {post.type === 'LOST' ? 'found' : 'lost'} posts, ranked by how closely they
            match this one (category, date, location and description).
          </p>
          {matchesLoading && <p className="muted">Looking for matches...</p>}
          {matchesError && <p className="error">{matchesError}</p>}
          {!matchesLoading && !matchesError && matches.length === 0 && (
            <p className="muted">No likely matches yet — check back later.</p>
          )}
          {matches.length > 0 && (
            <div className="post-grid">
              {matches.map((m) => (
                <div key={m.post.id} className="match-wrapper">
                  <span className="match-score">{m.score}% match</span>
                  <PostCard post={m.post} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
