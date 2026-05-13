import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function VerifyEmailPage() {
  const [params]  = useSearchParams();
  const token     = useMemo(() => params.get('token') || '', [params]);
  const [status,  setStatus]  = useState('loading'); // loading | success | error
  const [message, setMessage] = useState('');

  useEffect(() => {
    const run = async () => {
      if (!token) { setStatus('error'); setMessage('Missing verification token.'); return; }
      try {
        const { data } = await authAPI.verifyEmail(token);
        setStatus('success'); setMessage(data.message);
      } catch (err) {
        setStatus('error'); setMessage(err.response?.data?.message || 'Verification failed.');
      }
    };
    run();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg-primary)' }}>
      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <Link to="/login"><div className="text-4xl mb-2">✦</div>
            <h1 className="text-2xl font-cinzel gradient-text">ShayeriGram</h1></Link>
        </div>

        <div className="glass rounded-2xl p-8 text-center">
          {status === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-4">
              <LoadingSpinner size="lg" />
              <p style={{ color: 'var(--text-muted)' }}>Verifying your email...</p>
            </div>
          )}

          {status === 'success' && (
            <div className="py-4">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Email Verified!</h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>{message}</p>
              <Link to="/login" className="btn-primary inline-block py-3 px-6">Sign In Now</Link>
            </div>
          )}

          {status === 'error' && (
            <div className="py-4">
              <div className="text-5xl mb-4">❌</div>
              <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Verification Failed</h2>
              <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>{message}</p>
              <div className="flex flex-col gap-3">
                <Link to="/login" className="btn-primary inline-block py-3 px-6">Go to Login</Link>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Link expired?{' '}
                  <Link to="/login" style={{ color: 'var(--purple-light)' }}>
                    Request new verification
                  </Link>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
