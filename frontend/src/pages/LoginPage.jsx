import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) { setError('Please fill all fields'); return; }
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    }
    setLoading(false);
  };

  // Demo credentials
  const demoLogin = async () => {
    setForm({ email: 'demo@shayerigram.com', password: 'demo1234' });
    setLoading(true);
    try {
      await login('demo@shayerigram.com', 'demo1234');
      navigate('/');
    } catch {
      setError('Demo account not available. Please register.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)' }}>
      {/* Left decorative panel — desktop only */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center relative overflow-hidden p-12"
        style={{ background: 'linear-gradient(135deg, #080810, #130a2e, #1a0533)' }}>
        {/* Orbs */}
        <div className="absolute w-96 h-96 rounded-full -top-20 -left-20 opacity-20"
          style={{ background: 'radial-gradient(circle, #9333ea, transparent)', filter: 'blur(80px)' }} />
        <div className="absolute w-96 h-96 rounded-full -bottom-20 -right-20 opacity-15"
          style={{ background: 'radial-gradient(circle, #7c3aed, transparent)', filter: 'blur(80px)' }} />
        <div className="absolute w-64 h-64 rounded-full top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-10"
          style={{ background: 'radial-gradient(circle, #c084fc, transparent)', filter: 'blur(60px)' }} />

        {/* Content */}
        <div className="relative z-10 text-center max-w-md">
          <div className="text-6xl mb-6 animate-float">✦</div>
          <h1 className="text-5xl font-cinzel gradient-text mb-4 leading-tight">ShayeriGram</h1>
          <p className="text-lg font-shayari italic mb-8" style={{ color: 'var(--text-secondary)', lineHeight: '2' }}>
            जहाँ शब्द बोलते हैं,<br />
            जहाँ दिल की बात होती है,<br />
            <span className="gradient-text-gold">जहाँ शायरी ज़िन्दा है।</span>
          </p>
          {/* Feature pills */}
          <div className="flex flex-wrap gap-2 justify-center">
            {['Share Poetry', 'Follow Shayars', 'Explore Emotions', 'Connect Souls'].map(f => (
              <span key={f} className="text-xs px-3 py-1.5 rounded-full font-medium"
                style={{ background: 'rgba(147,51,234,0.15)', border: '1px solid rgba(147,51,234,0.3)', color: 'var(--purple-light)' }}>
                {f}
              </span>
            ))}
          </div>
          {/* Sample shayari card */}
          <div className="mt-10 p-6 rounded-2xl text-left glass animate-fade-in">
            <p className="font-shayari text-sm leading-loose" style={{ color: 'var(--text-secondary)' }}>
              "तेरे बिना जिंदगी से कोई<br />
              शिकवा तो नहीं,<br />
              तेरे बिना जिंदगी भी लेकिन<br />
              <span style={{ color: 'var(--purple-light)' }}>जिंदगी तो नहीं।"</span>
            </p>
            <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>— Gulzar</p>
          </div>
        </div>
      </div>

      {/* Right login form */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm animate-fade-in">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="text-4xl mb-2 animate-float">✦</div>
            <h1 className="text-3xl font-cinzel gradient-text">ShayeriGram</h1>
            <p className="text-xs mt-1 font-shayari italic" style={{ color: 'var(--text-muted)' }}>जहाँ शब्द बोलते हैं</p>
          </div>

          <div className="glass rounded-2xl p-8">
            <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Welcome back</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Sign in to continue your journey</p>

            {error && (
              <div className="mb-4 p-3 rounded-xl text-sm text-red-300 animate-fade-in"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Email</label>
                <input
                  name="email" type="email" value={form.email} onChange={handleChange}
                  placeholder="your@email.com" className="input-field" autoComplete="email"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Password</label>
                  <Link to="/forgot-password" className="text-xs hover:opacity-80 transition-opacity"
                    style={{ color: 'var(--purple-light)' }}>Forgot password?</Link>
                </div>
                <div className="relative">
                  <input
                    name="password" type={showPass ? 'text' : 'password'}
                    value={form.password} onChange={handleChange}
                    placeholder="••••••••" className="input-field pr-12" autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-sm"
                    style={{ color: 'var(--text-muted)' }}>
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 mt-2">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white/20 inline-block"
                      style={{ borderTopColor: 'white', animation: 'spin 0.8s linear infinite' }} />
                    Signing in...
                  </span>
                ) : 'Sign In'}
              </button>
            </form>

            {/* Demo */}
            <div className="mt-3">
              <button onClick={demoLogin} disabled={loading} className="btn-ghost w-full py-3 text-sm">
                🎭 Try Demo Account
              </button>
            </div>

            <div className="mt-5 text-center">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                New to ShayeriGram?{' '}
                <Link to="/register" className="font-semibold hover:opacity-80 transition-opacity" style={{ color: 'var(--purple-light)' }}>
                  Create account
                </Link>
              </p>
            </div>
            <div className="mt-5 pt-4 border-t text-center text-xs space-y-2" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
              <p>By using ShayeriGram, you agree to our</p>
              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
                <Link to="/policies/terms" className="hover:text-purple-300" style={{ color: 'var(--purple-light)' }}>Terms</Link>
                <Link to="/policies/privacy" className="hover:text-purple-300" style={{ color: 'var(--purple-light)' }}>Privacy</Link>
                <Link to="/policies/community" className="hover:text-purple-300" style={{ color: 'var(--purple-light)' }}>Community Guidelines</Link>
                <Link to="/policies/cookies" className="hover:text-purple-300" style={{ color: 'var(--purple-light)' }}>Cookies</Link>
                <Link to="/policies/content" className="hover:text-purple-300" style={{ color: 'var(--purple-light)' }}>Content Policy</Link>
                <Link to="/policies/copyright" className="hover:text-purple-300" style={{ color: 'var(--purple-light)' }}>Copyright</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
