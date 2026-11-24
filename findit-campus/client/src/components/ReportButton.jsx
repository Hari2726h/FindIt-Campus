import { useState } from 'react';
import { api } from '../api/client';

export default function ReportButton({ targetType, targetId, label = 'Report' }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  if (done) {
    return <span className="muted report-done">Reported — thanks for flagging this.</span>;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api.createReport(targetType, targetId, reason);
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="link-button report-trigger" onClick={() => setOpen(true)}>
        {label}
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="report-form">
      {error && <p className="error">{error}</p>}
      <textarea
        required
        rows={2}
        placeholder="Why are you reporting this?"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="report-form-actions">
        <button type="submit" disabled={busy}>{busy ? 'Sending...' : 'Submit report'}</button>
        <button type="button" className="link-button" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
