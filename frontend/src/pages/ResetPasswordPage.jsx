import { useMemo, useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

export default function ResetPasswordPage() {
  const [params]    = useSearchParams();
  const navigate    = useNavigate();
  const token       = useMemo(() => params.get('token') || '', [params]);
  const [password,  setPassword]  = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [msg,       setMsg]       = useState('');
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);

  const strength = password.length === 0 ? 0 : password.length < 8 ? 1 : password.length < 12 ? 2 : 3;
  const strengthColors = ['', '#ef4444', '#f59e0b', '#22c55e'];

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    if (!token) { setError('Invalid reset link. Please request a new one.'); return; }
    setLoading(true);
    try {
      const { data } = await authAPI.resetPassword({ token, password });
      setMsg(data.message);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg-primary)' }}>
      <div className="fixed w-96 h-96 rounded-full top-0 right-1/3 opacity-[0.07] pointer-events-none"
        style={{ background: 'radial-gradient(circle, #9333ea, transparent)', filter: 'blur(80px)' }} />

      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <Link to="/login"><div className="text-4xl mb-2">✦</div>
            <h1 className="text-2xl font-cinzel gradient-text">ShayeriGram</h1></Link>
        </div>

        <div className="glass rounded-2xl p-8">
          <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Reset password</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Enter your new password below.</p>

          {msg && (
            <div className="mb-4 p-3 rounded-xl text-sm animate-fade-in"
              style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#86efac' }}>
              ✅ {msg} Redirecting to login...
            </div>
          )}
          {error && (
            <div className="mb-4 p-3 rounded-xl text-sm animate-fade-in"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5' }}>
              {error}
            </div>
          )}

          {!msg && (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>New Password</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Min. 8 characters" className="input-field pr-12" required />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-sm"
                    style={{ color: 'var(--text-muted)' }}>{showPass ? '🙈' : '👁️'}</button>
                </div>
                {password.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex-1 h-1 rounded-full transition-all"
                        style={{ background: i <= strength ? strengthColors[strength] : 'var(--border)' }} />
                    ))}
                  </div>
                )}
              </div>
              <button type="submit" disabled={loading || !token} className="btn-primary w-full py-3.5">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white/20 inline-block"
                      style={{ borderTopColor: 'white', animation: 'spin 0.8s linear infinite' }} />
                    Resetting...
                  </span>
                ) : 'Reset Password'}
              </button>
            </form>
          )}

          <div className="mt-5 text-center">
            <Link to="/login" className="text-sm hover:opacity-80" style={{ color: 'var(--purple-light)' }}>
              ← Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
