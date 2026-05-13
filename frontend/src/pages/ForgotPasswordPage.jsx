import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../services/api';

export default function ForgotPasswordPage() {
  const [email,   setEmail]   = useState('');
  const [msg,     setMsg]     = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(''); setMsg('');
    setLoading(true);
    try {
      const { data } = await authAPI.forgotPassword({ email });
      setMsg(data.message);
    } catch (err) {
      setError(err.response?.data?.message || 'Request failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg-primary)' }}>
      {/* Orb */}
      <div className="fixed w-96 h-96 rounded-full top-0 left-1/3 opacity-[0.07] pointer-events-none"
        style={{ background: 'radial-gradient(circle, #9333ea, transparent)', filter: 'blur(80px)' }} />

      <div className="w-full max-w-sm animate-fade-in">
        <div className="text-center mb-8">
          <Link to="/login" className="inline-block">
            <div className="text-4xl mb-2">✦</div>
            <h1 className="text-2xl font-cinzel gradient-text">ShayeriGram</h1>
          </Link>
        </div>

        <div className="glass rounded-2xl p-8">
          <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Forgot password?</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            Enter your email and we'll send you a reset link.
          </p>

          {msg && (
            <div className="mb-4 p-3 rounded-xl text-sm animate-fade-in"
              style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.2)', color: '#86efac' }}>
              ✅ {msg}
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
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com" className="input-field" required />
              </div>
              <button type="submit" disabled={loading} className="btn-primary w-full py-3.5">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white/20 inline-block"
                      style={{ borderTopColor: 'white', animation: 'spin 0.8s linear infinite' }} />
                    Sending...
                  </span>
                ) : 'Send Reset Link'}
              </button>
            </form>
          )}

          <div className="mt-5 text-center">
            <Link to="/login" className="text-sm hover:opacity-80 transition-opacity" style={{ color: 'var(--purple-light)' }}>
              ← Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
