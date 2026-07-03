import axios from 'axios';

// ─── Logout Guard ─────────────────────────────────────────────────────────
// Refresh interceptor ko block karta hai jab logout ho raha ho,
// warna pending 401 requests refresh trigger kar ke user ko wapas login kar deti hain
let isLoggingOut = false;
export const setLoggingOut = (value) => {
  isLoggingOut = value;
};

// ─── Axios Instance ───────────────────────────────────────────────────────
// withCredentials: true — HttpOnly cookies automatically send/receive hoti hain
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://shayerigram.onrender.com/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// ─── Public Path Check ────────────────────────────────────────────────────
// In paths pe 401 se redirect nahi hoga
const isPublicPath = (path) =>
  path === '/login' ||
  path === '/register' ||
  path.startsWith('/policies/');

// ─── Token Refresh Queue ──────────────────────────────────────────────────
// Refresh in-flight ho to baaki requests queue me rakhti hain,
// refresh complete hone pe sab retry hoti hain
let isRefreshing = false;
let failedQueue  = [];

const processQueue = (error) => {
  failedQueue.forEach(p => error ? p.reject(error) : p.resolve());
  failedQueue = [];
};

// ─── Response Interceptor ─────────────────────────────────────────────────
// 401 aane pe access token refresh karta hai (15m expiry),
// user 90 din tak logged in rehta hai bina manual login ke
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status     = err.response?.status;
    const requestUrl = err.config?.url || '';
    const original   = err.config;

    // Logout chal raha ho to refresh bilkul mat karo
    if (isLoggingOut) {
      return Promise.reject(err);
    }

    // Auth endpoints pe refresh loop avoid karna zaroori hai
    const isAuthEndpoint =
      requestUrl.includes('/auth/refresh') ||
      requestUrl.includes('/auth/login')   ||
      requestUrl.includes('/auth/register')||
      requestUrl.includes('/auth/logout');

    if (status === 401 && !isAuthEndpoint && !original._retry) {
      if (isRefreshing) {
        // Refresh already chal raha hai — queue me daal do
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(original)).catch(e => Promise.reject(e));
      }

      original._retry = true;
      isRefreshing    = true;

      try {
        await api.post('/auth/refresh');
        processQueue(null);
        return api(original); // Naye token ke saath original request retry
      } catch (refreshErr) {
        processQueue(refreshErr);
        // Refresh fail — genuinely logged out, login pe bhejo
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

// ─── Auth API ─────────────────────────────────────────────────────────────
export const authAPI = {
  register:           (data)  => api.post('/auth/register', data),
  login:              (data)  => api.post('/auth/login', data),
  me:                 ()      => api.get('/auth/me'),
  logout:             ()      => api.post('/auth/logout'),
  verifyEmail:        (token) => api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`),
  resendVerification: (data)  => api.post('/auth/resend-verification', data),
  forgotPassword:     (data)  => api.post('/auth/forgot-password', data),
  resetPassword:      (data)  => api.post('/auth/reset-password', data),
};

// ─── Users API ────────────────────────────────────────────────────────────
export const userAPI = {
  getProfile:    (username)      => api.get(`/users/${username}`),
  getUserPosts:  (username, p)   => api.get(`/users/${username}/posts`, { params: p }),
  updateProfile: (data)          => api.put('/users/profile', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  toggleFollow:  (id)            => api.post(`/users/${id}/follow`),
  getSuggestions: ()             => api.get('/users/suggestions'),
  getFollowers:  (username, p)   => api.get(`/users/${username}/followers`, { params: p }),
  getFollowing:  (username, p)   => api.get(`/users/${username}/following`, { params: p }),
  getSavedPosts: ()              => api.get('/users/saved'),
};

// ─── Posts API ────────────────────────────────────────────────────────────
export const postAPI = {
  getFeed:       (params)    => api.get('/posts/feed', { params }),
  getTrending:   ()          => api.get('/posts/trending'),
  createPost:    (data)      => api.post('/posts', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getPost:       (id)        => api.get(`/posts/${id}`),
  deletePost:    (id)        => api.delete(`/posts/${id}`),
  toggleLike:    (id)        => api.post(`/posts/${id}/like`),
  addComment:    (id, text)  => api.post(`/posts/${id}/comment`, { text }),
  deleteComment:     (id, cId) => api.delete(`/posts/${id}/comment/${cId}`),
  toggleCommentLike: (id, cId) => api.post(`/posts/${id}/comment/${cId}/like`),
  toggleSave:    (id)        => api.post(`/posts/${id}/save`),
  reportPost:    (id)        => api.post(`/posts/${id}/report`),
  getComments:   (id, params)=> api.get(`/posts/${id}/comments`, { params }),
};

// ─── Settings API ─────────────────────────────────────────────────────────
export const settingsAPI = {
  get:           ()     => api.get('/settings'),
  update:        (data) => api.put('/settings', data),
  deleteAccount: (data) => api.delete('/settings/account', { data }),
  deactivate:    (data) => api.post('/settings/deactivate', data),
};

// ─── Notifications API ────────────────────────────────────────────────────
export const notifAPI = {
  getAll:      () => api.get('/notifications'),
  markRead:    () => api.put('/notifications/mark-read'),
  unreadCount: () => api.get('/notifications/unread-count'),
};

// ─── Explore API ──────────────────────────────────────────────────────────
export const exploreAPI = {
  search:      (q, type)     => api.get('/explore/search', { params: { q, type } }),
  getCategory: (cat, params) => api.get(`/explore/category/${cat}`, { params }),
  getAllPosts:  (params)      => api.get('/explore/all', { params }),
  getHashtag:  (tag)         => api.get(`/explore/hashtag/${tag}`),
  getTrendingStories: ()      => api.get('/explore/trending/stories'),
  getNewWriters:      ()      => api.get('/explore/new-writers'),
  getLeaderboard:     (type, period) => api.get('/explore/leaderboard', { params: { type, period } }),
};

// ─── Admin API ────────────────────────────────────────────────────────────
export const adminAPI = {
  getStats:        ()         => api.get('/admin/stats'),
  getReports:      (params)   => api.get('/admin/reports', { params }),
  reviewReport:    (id, data) => api.patch(`/admin/reports/${id}`, data),
  takedownPost:    (id)       => api.patch(`/admin/posts/${id}/takedown`),
  suspendUser:     (id, data) => api.patch(`/admin/users/${id}/suspend`, data),
  softDeleteUser:  (id, data) => api.patch(`/admin/users/${id}/soft-delete`, data),
  restorePost:     (id)       => api.patch(`/admin/posts/${id}/restore`),
  hardDeletePost:  (id)       => api.delete(`/admin/posts/${id}/hard-delete`),
  getDeletedPosts: (params)   => api.get('/admin/posts/deleted', { params }),
};


// ─── Stories API ──────────────────────────────────────────────────────────
export const storyAPI = {
  getStories:      (params)       => api.get('/stories', { params }),
  getStory:        (id)           => api.get(`/stories/${id}`),
  getUserStories:  (userId, p)    => api.get(`/stories/user/${userId}`, { params: p }),
  getMyStories:    (params)       => api.get('/stories/my/stories', { params }),
  createStory:     (data)         => api.post('/stories', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateStory:     (id, data)     => api.put(`/stories/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteStory:     (id)           => api.delete(`/stories/${id}`),
  toggleBookmark:  (id)           => api.post(`/stories/${id}/bookmark`),
  getMyBookmarks:  (params)       => api.get('/stories/my/bookmarks', { params }),
  saveProgress:    (id, data)     => api.post(`/stories/${id}/progress`, data),
  getReadingHistory: (params)     => api.get('/stories/my/reading-history', { params }),
  toggleLike:      (id)           => api.post(`/stories/${id}/like`),
  addComment:      (id, text)     => api.post(`/stories/${id}/comment`, { text }),
  getComments:     (id, params)   => api.get(`/stories/${id}/comments`, { params }),
  getSimilarStories: (id)         => api.get(`/stories/${id}/similar`),
  deleteComment:     (id, cId)    => api.delete(`/stories/${id}/comment/${cId}`),
  toggleCommentLike: (id, cId)    => api.post(`/stories/${id}/comment/${cId}/like`),
};

// ─── Analytics API ────────────────────────────────────────────────────────
export const analyticsAPI = {
  getMyAnalytics: () => api.get('/analytics/me'),
};

// ─── Clubs API ────────────────────────────────────────────────────────────
export const clubAPI = {
  getClubs:          (params)     => api.get('/clubs', { params }),
  getClub:           (id)         => api.get(`/clubs/${id}`),
  getClubPosts:      (id, params) => api.get(`/clubs/${id}/posts`, { params }),
  createClub:        (data)       => api.post('/clubs', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  toggleMembership:  (id)         => api.post(`/clubs/${id}/membership`),
  getMyClubs:        ()           => api.get('/clubs/my/clubs'),
};

// ─── Chapters API ─────────────────────────────────────────────────────────
export const chapterAPI = {
  getChapters:     (storyId)      => api.get(`/chapters/story/${storyId}`),
  getChapter:      (id)           => api.get(`/chapters/${id}`),
  addChapter:      (storyId, data)=> api.post(`/chapters/story/${storyId}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateChapter:   (id, data)     => api.put(`/chapters/${id}`, data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  deleteChapter:   (id)           => api.delete(`/chapters/${id}`),
  reorderChapters: (storyId, order) => api.put(`/chapters/story/${storyId}/reorder`, { chapterOrder: order }),
};

export default api;