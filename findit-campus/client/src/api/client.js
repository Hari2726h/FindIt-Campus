const BASE_URL = '/api';

function getToken() {
  return localStorage.getItem('fc_token');
}

async function request(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !isForm) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? (isForm ? body : JSON.stringify(body)) : undefined,
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && token) {
    // A 401 on a request that carried a token means the token itself is
    // stale/expired (not a login/signup failure — those have no token yet).
    // Without this, an expired session just surfaces "Invalid or expired
    // token" as a raw error on every page, forever, since nothing else ever
    // clears it or prompts a fresh login.
    localStorage.removeItem('fc_token');
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }

  if (!res.ok) {
    throw new Error(data.error || `Request failed with status ${res.status}`);
  }
  return data;
}

export const api = {
  signup: (payload) => request('/auth/signup', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  me: () => request('/auth/me'),

  listPosts: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return request(`/posts${qs ? `?${qs}` : ''}`);
  },
  myPosts: () => request('/posts/mine'),
  getPost: (id) => request(`/posts/${id}`),
  getMatches: (id) => request(`/posts/${id}/matches`),
  createPost: (formData) => request('/posts', { method: 'POST', body: formData, isForm: true }),
  updatePost: (id, formData) => request(`/posts/${id}`, { method: 'PUT', body: formData, isForm: true }),
  markResolved: (id) => request(`/posts/${id}`, { method: 'PUT', body: { status: 'RESOLVED' } }),
  deletePost: (id) => request(`/posts/${id}`, { method: 'DELETE' }),

  claimPost: (postId, answerText) =>
    request(`/posts/${postId}/claims`, { method: 'POST', body: { answerText } }),
  getMyClaimForPost: (postId) => request(`/posts/${postId}/claims/mine`),
  listClaimsForPost: (postId) => request(`/posts/${postId}/claims`),
  confirmClaim: (claimId) => request(`/claims/${claimId}/confirm`, { method: 'POST' }),
  rejectClaim: (claimId) => request(`/claims/${claimId}/reject`, { method: 'POST' }),
  listMessages: (claimId) => request(`/claims/${claimId}/messages`),
  sendMessage: (claimId, text) => request(`/claims/${claimId}/messages`, { method: 'POST', body: { text } }),
  myClaims: () => request('/claims/mine'),

  createReport: (targetType, targetId, reason) =>
    request('/reports', { method: 'POST', body: { targetType, targetId, reason } }),

  getAdminStats: () => request('/admin/stats'),
  listAdminReports: () => request('/admin/reports'),
  updateReportStatus: (id, status) => request(`/admin/reports/${id}`, { method: 'PATCH', body: { status } }),
  adminDeletePost: (id) => request(`/admin/posts/${id}`, { method: 'DELETE' }),
};
