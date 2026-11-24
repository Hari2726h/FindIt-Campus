import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { CATEGORIES } from '../constants';

export default function NewPost() {
  const navigate = useNavigate();
  const [type, setType] = useState('LOST');
  const [form, setForm] = useState({
    category: CATEGORIES[0],
    title: '',
    description: '',
    dateEvent: '',
    locationText: '',
    questionText: '',
    secretAnswer: '',
  });
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const data = new FormData();
      data.append('type', type);
      data.append('category', form.category);
      data.append('title', form.title);
      data.append('description', form.description);
      data.append('dateEvent', form.dateEvent);
      data.append('locationText', form.locationText);
      if (type === 'FOUND') {
        data.append('questionText', form.questionText);
        data.append('secretAnswer', form.secretAnswer);
      }
      for (const file of files) data.append('images', file);

      const res = await api.createPost(data);
      navigate(`/posts/${res.post.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card form-card">
      <h2>New post</h2>
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="radio-row">
          <label><input type="radio" checked={type === 'LOST'} onChange={() => setType('LOST')} /> Lost item</label>
          <label><input type="radio" checked={type === 'FOUND'} onChange={() => setType('FOUND')} /> Found item</label>
        </div>

        <label>Category
          <select value={form.category} onChange={(e) => update('category', e.target.value)}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <label>Title
          <input required value={form.title} onChange={(e) => update('title', e.target.value)} />
        </label>

        <label>Description
          <textarea required rows={3} value={form.description}
            onChange={(e) => update('description', e.target.value)} />
        </label>

        <label>{type === 'LOST' ? 'Date lost' : 'Date found'}
          <input type="date" required value={form.dateEvent} onChange={(e) => update('dateEvent', e.target.value)} />
        </label>

        <label>Location
          <input required value={form.locationText} onChange={(e) => update('locationText', e.target.value)} />
        </label>

        <label>Photos (up to 5)
          <input type="file" accept="image/*" multiple onChange={(e) => setFiles([...e.target.files])} />
        </label>

        {type === 'FOUND' && (
          <div className="verification-box">
            <h4>Hidden verification question</h4>
            <p className="muted">
              Only you will see the answer. Whoever claims this item must answer it correctly before you
              hand it over or open chat with them.
            </p>
            <label>Question to ask the claimant
              <input required placeholder='e.g. "What is written on the inside flap?"'
                value={form.questionText} onChange={(e) => update('questionText', e.target.value)} />
            </label>
            <label>Secret answer (never shown publicly)
              <input required value={form.secretAnswer} onChange={(e) => update('secretAnswer', e.target.value)} />
            </label>
          </div>
        )}

        <button type="submit" disabled={busy}>{busy ? 'Posting...' : 'Submit post'}</button>
      </form>
    </div>
  );
}
