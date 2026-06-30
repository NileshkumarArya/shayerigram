import { Suspense, lazy, memo } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoadingSpinner from './components/common/LoadingSpinner';
import ErrorBoundary from './components/common/ErrorBoundary';

const Layout             = lazy(() => import('./components/layout/Layout'));
const HomePage           = lazy(() => import('./pages/HomePage'));
const LoginPage          = lazy(() => import('./pages/LoginPage'));
const RegisterPage       = lazy(() => import('./pages/RegisterPage'));
const ProfilePage        = lazy(() => import('./pages/ProfilePage'));
const ExplorePage        = lazy(() => import('./pages/ExplorePage'));
const PostPage           = lazy(() => import('./pages/PostPage'));
const NotificationsPage  = lazy(() => import('./pages/NotificationsPage'));
const SavedPage          = lazy(() => import('./pages/SavedPage'));
const EditProfilePage    = lazy(() => import('./pages/EditProfilePage'));
const CreatePostPage     = lazy(() => import('./pages/CreatePostPage'));
const HashtagPage        = lazy(() => import('./pages/HashtagPage'));
const PolicyPage         = lazy(() => import('./pages/PolicyPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage  = lazy(() => import('./pages/ResetPasswordPage'));
const VerifyEmailPage    = lazy(() => import('./pages/VerifyEmailPage'));
const AdminPage          = lazy(() => import('./pages/AdminPage'));
const SettingsPage       = lazy(() => import('./pages/SettingsPage'));
const StoriesPage        = lazy(() => import('./pages/StoriesPage'));
const CreateStoryPage    = lazy(() => import('./pages/CreateStoryPage'));
const EditStoryPage      = lazy(() => import('./pages/EditStoryPage'));
const StoryDetailPage    = lazy(() => import('./pages/StoryDetailPage'));
const ReadStoryPage      = lazy(() => import('./pages/ReadStoryPage'));


const RouteFallback = memo(function RouteFallback() {
  return <LoadingSpinner fullScreen />;
});

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
    <ErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Public routes */}
          <Route path="/login"           element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register"        element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
          <Route path="/reset-password"  element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
          <Route path="/verify-email"    element={<VerifyEmailPage />} />

          <Route path="/admin"    element={<PrivateRoute><AdminPage /></PrivateRoute>} />
          <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />

          {/* Policy pages */}
          <Route path="/policies/:slug" element={<PolicyPage />} />
          <Route path="/policies"       element={<Navigate to="/policies/terms" replace />} />

          {/* Protected routes */}
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index                    element={<HomePage />} />
            <Route path="explore"           element={<ExplorePage />} />
            <Route path="notifications"     element={<NotificationsPage />} />
            <Route path="saved"             element={<SavedPage />} />
            <Route path="create"            element={<CreatePostPage />} />
            <Route path="profile/edit"      element={<EditProfilePage />} />
            <Route path="profile/:username" element={<ProfilePage />} />
            <Route path="post/:id"          element={<PostPage />} />
            <Route path="hashtag/:tag"      element={<HashtagPage />} />
            <Route path="stories"               element={<StoriesPage />} />
            <Route path="story/create"          element={<CreateStoryPage />} />
            <Route path="story/:storyId/edit"   element={<EditStoryPage />} />
            <Route path="story/:storyId"        element={<StoryDetailPage />} />
            <Route path="read/:chapterId"       element={<ReadStoryPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}