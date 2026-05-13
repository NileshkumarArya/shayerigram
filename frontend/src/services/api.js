import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true, // Send/receive HttpOnly cookies automatically
});

// Helper: which paths should NOT trigger a redirect on 401
const isPublicPath = (path) =>
  path === '/login' ||
  path === '/register' ||
  path.startsWith('/policies/');

// ─── Refresh Token Interceptor ────────────────────────────────────────────
// Auto-refresh access token when it expires (15m) using httpOnly refresh cookie
// Prevents auto-logout — user stays logged in for 90 days

let isRefreshing = false;
let failedQueue  = [];

const processQueue = (error) => {
  failedQueue.forEach(p => error ? p.reject(error) : p.resolve());
  failedQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status     = err.response?.status;
    const requestUrl = err.config?.url || '';
    const original   = err.config;

    // Skip refresh for auth endpoints themselves
    const isAuthEndpoint =
      requestUrl.includes('/auth/refresh') ||
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/register') ||
      requestUrl.includes('/auth/logout');

    if (status === 401 && !isAuthEndpoint && !original._retry) {
      if (isRefreshing) {
        // Queue requests while refresh is in-flight
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(original)).catch(e => Promise.reject(e));
      }

      original._retry  = true;
      isRefreshing     = true;

      try {
        await api.post('/auth/refresh');
        processQueue(null);
        return api(original); // Retry original request with new token
      } catch (refreshErr) {
        processQueue(refreshErr);
        // Refresh failed → truly logged out → redirect
        if (!isPublicPath(window.location.pathname)) {
          window.location.href = '/login';
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(err);
  }
);

// ─── Auth ─────────────────────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login:    (data) => api.post('/auth/login', data),
  me:       ()     => api.get('/auth/me'),
  logout:             ()      => api.post('/auth/logout'),
  verifyEmail:        (token) => api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`),
  resendVerification: (data)  => api.post('/auth/resend-verification', data),
  forgotPassword:     (data)  => api.post('/auth/forgot-password', data),
  resetPassword:      (data)  => api.post('/auth/reset-password', data),
};

// ─── Users ────────────────────────────────────────────────────────────────
export const userAPI = {
  getProfile:     (username) => api.get(`/users/${username}`),
  getUserPosts:   (username, params) => api.get(`/users/${username}/posts`, { params }),
  updateProfile:  (data) => api.put('/users/profile', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  toggleFollow:   (id) => api.post(`/users/${id}/follow`),
  getSuggestions:  ()            => api.get('/users/suggestions'),
  getFollowers:    (username, p) => api.get(`/users/${username}/followers`, { params: p }),
  getFollowing:    (username, p) => api.get(`/users/${username}/following`, { params: p }),
  getSavedPosts:  () => api.get('/users/saved'),
};

// ─── Posts ────────────────────────────────────────────────────────────────
export const postAPI = {
  getFeed:      (params) => api.get('/posts/feed', { params }), // supports ?cursor=xxx&limit=10
  getTrending:  () => api.get('/posts/trending'),
  createPost:   (data) => api.post('/posts', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getPost:      (id) => api.get(`/posts/${id}`),
  deletePost:   (id) => api.delete(`/posts/${id}`),
  toggleLike:   (id) => api.post(`/posts/${id}/like`),
  addComment:   (id, text) => api.post(`/posts/${id}/comment`, { text }),
  deleteComment:(id, cId) => api.delete(`/posts/${id}/comment/${cId}`),
  toggleSave:   (id) => api.post(`/posts/${id}/save`),
  reportPost:   (id) => api.post(`/posts/${id}/report`),
  getComments:  (id, params) => api.get(`/posts/${id}/comments`, { params }),
};

// ─── Settings ────────────────────────────────────────────────────────────
export const settingsAPI = {
  get:    ()     => api.get('/settings'),
  update: (data) => api.put('/settings', data),
  deleteAccount: (data) => api.delete('/settings/account', { data }),
  deactivate: (data) => api.post('/settings/deactivate', data),
};

// ─── Notifications ────────────────────────────────────────────────────────
export const notifAPI = {
  getAll:      () => api.get('/notifications'),
  markRead:    () => api.put('/notifications/mark-read'),
  unreadCount: () => api.get('/notifications/unread-count'),
};

// ─── Explore ──────────────────────────────────────────────────────────────
export const exploreAPI = {
  search:      (q, type)    => api.get('/explore/search', { params: { q, type } }),
  getCategory: (cat, params) => api.get(`/explore/category/${cat}`, { params }),
  getAllPosts:  (params)      => api.get('/explore/all', { params }),   // ✅ New: all recent posts
  getHashtag:  (tag) => api.get(`/explore/hashtag/${tag}`),
};

// ─── Admin ────────────────────────────────────────────────────────────────
export const adminAPI = {
  getStats:     ()               => api.get('/admin/stats'),
  getReports:   (params)         => api.get('/admin/reports', { params }),
  reviewReport: (id, data)       => api.patch(`/admin/reports/${id}`, data),
  takedownPost: (id)             => api.patch(`/admin/posts/${id}/takedown`),
  suspendUser:     (id, data) => api.patch(`/admin/users/${id}/suspend`, data),
  softDeleteUser:  (id, data) => api.patch(`/admin/users/${id}/soft-delete`, data),
  restorePost:     (id)       => api.patch(`/admin/posts/${id}/restore`),
  hardDeletePost:  (id)       => api.delete(`/admin/posts/${id}/hard-delete`),
  getDeletedPosts: (params)   => api.get('/admin/posts/deleted', { params }),
};

export default api;
