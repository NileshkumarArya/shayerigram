import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/layout/Layout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import ExplorePage from './pages/ExplorePage';
import PostPage from './pages/PostPage';
import NotificationsPage from './pages/NotificationsPage';
import SavedPage from './pages/SavedPage';
import EditProfilePage from './pages/EditProfilePage';
import CreatePostPage from './pages/CreatePostPage';
import HashtagPage from './pages/HashtagPage';
import PolicyPage from './pages/PolicyPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import AdminPage    from './pages/AdminPage';
import SettingsPage from './pages/SettingsPage';
import LoadingSpinner from './components/common/LoadingSpinner';
import ErrorBoundary from './components/common/ErrorBoundary';

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner fullScreen />;
  return user ? children : <Navigate to="/login" replace />;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingSpinner fullScreen />;
  return !user ? children : <Navigate to="/" replace />;
};

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login"    element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register"        element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/forgot-password"   element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
      <Route path="/reset-password"    element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
      <Route path="/verify-email"      element={<VerifyEmailPage />} />
      <Route path="/admin"             element={<PrivateRoute><AdminPage /></PrivateRoute>} />
      <Route path="/settings"           element={<PrivateRoute><SettingsPage /></PrivateRoute>} />

      {/* Policy pages — always accessible (logged in or not) */}
      <Route path="/policies/:slug" element={<PolicyPage />} />
      <Route path="/policies"       element={<Navigate to="/policies/terms" replace />} />

      {/* Protected routes */}
      <Route path="/" element={<PrivateRoute><ErrorBoundary><Layout /></ErrorBoundary></PrivateRoute>}>
        <Route index                  element={<HomePage />} />
        <Route path="explore"         element={<ExplorePage />} />
        <Route path="notifications"   element={<NotificationsPage />} />
        <Route path="saved"           element={<SavedPage />} />
        <Route path="create"          element={<CreatePostPage />} />
        <Route path="profile/edit"    element={<EditProfilePage />} />
        <Route path="profile/:username" element={<ProfilePage />} />
        <Route path="post/:id"        element={<PostPage />} />
        <Route path="hashtag/:tag"    element={<HashtagPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
