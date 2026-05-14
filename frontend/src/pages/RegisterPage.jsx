import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TurnstileWidget from '../components/common/TurnstileWidget';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate     = useNavigate();

  const [form, setForm] = useState({
    username: '', email: '', password: '', fullName: '',
    dateOfBirth: '', acceptTerms: false,
  });
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [showPass,      setShowPass]      = useState(false);
const [captchaToken, setCaptchaToken] = useState('auto-verify');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username || !form.email || !form.password) {
      setError('Please fill all required fields'); return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters'); return;
    }
    if (!form.acceptTerms) {
      setError('You must accept the Terms and Community Guidelines to continue'); return;
    }
    //if (!captchaToken) {
      //setError('Captcha verification required.'); return;
    //}
    setLoading(true);
    try {
      await register({ ...form, captchaToken });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    }
    setLoading(false);
  };

  const strength       = form.password.length === 0 ? 0 : form.password.length < 8 ? 1 : form.password.length < 12 ? 2 : 3;
  const strengthColors = ['', '#ef4444', '#f59e0b', '#22c55e'];

  // Max date for DOB — must be 13+
  const maxDob = new Date(Date.now() - 13 * 365.25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-primary)' }}>

      {/* ── Left Panel (desktop) ─────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center relative overflow-hidden p-12"
        style={{ background: 'linear-gradient(135deg, #080810, #130a2e)' }}>
        <div className="absolute w-96 h-96 rounded-full -top-20 -right-20 opacity-20"
          style={{ background: 'radial-gradient(circle, #9333ea, transparent)', filter: 'blur(80px)' }} />
        <div className="relative z-10 text-center max-w-md">
          <div className="text-6xl mb-4 animate-float">✦</div>
          <h1 className="text-4xl font-cinzel gradient-text mb-4">Join ShayeriGram</h1>
          <p className="text-sm font-shayari italic mb-8" style={{ color: 'var(--text-secondary)', lineHeight: '2' }}>
            हर दिल में एक शायर छुपा है।<br/>
            अपनी आवाज़ को यहाँ दो पंख...
          </p>
          <div className="space-y-3">
            {['Share your Shayari', 'Follow other Shayars', 'Explore trending poetry', 'Connect with souls'].map(f => (
              <div key={f} className="flex items-center gap-3 text-left">
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg, #9333ea, #7c3aed)' }}>
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{f}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right Panel — Form ───────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm animate-fade-in">

          {/* Mobile logo — less space */}
          <div className="lg:hidden text-center mb-4">
            <div className="text-3xl mb-1 animate-float">✦</div>
            <h1 className="text-2xl font-cinzel gradient-text">ShayeriGram</h1>
          </div>

          <div className="glass rounded-2xl p-8">
            <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Create account</h2>
            <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Start your shayari journey today</p>

            {error && (
              <div className="mb-4 p-3 rounded-xl text-sm text-red-300 animate-fade-in"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Full Name — no "(optional)" label */}
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>
                  Full Name
                </label>
                <input name="fullName" value={form.fullName} onChange={handleChange}
                  placeholder="Mirza Ghalib" className="input-field" />
              </div>

              {/* Username */}
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Username *</label>
                <div className="flex items-center gap-2 rounded-xl px-4"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)' }}>
                  <span className="text-sm font-semibold shrink-0" style={{ color: 'var(--purple-light)' }}>@</span>
                  <input
                    name="username"
                    value={form.username}
                    onChange={e => {
                      const val = e.target.value.replace(/@/g, '');
                      setForm(prev => ({ ...prev, username: val }));
                      if (error) setError('');
                    }}
                    placeholder="your_username"
                    className="flex-1 bg-transparent outline-none py-3.5 text-sm"
                    style={{ color: 'var(--text-primary)' }}
                    autoComplete="username"
                    maxLength={30}
                  />
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Letters, numbers, _ and . only</p>
              </div>

              {/* Email */}
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Email *</label>
                <input name="email" type="email" value={form.email} onChange={handleChange}
                  placeholder="your@email.com" className="input-field" autoComplete="email" />
              </div>

              {/* Date of Birth — BEFORE password */}
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Date of Birth</label>
                <input
                  name="dateOfBirth"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={handleChange}
                  max={maxDob}
                  className="input-field"
                  style={{ colorScheme: 'dark' }}
                />
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Must be 13 or older to register</p>
              </div>

              {/* Password — eye icon properly placed */}
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-muted)' }}>Password *</label>
                <div className="relative">
                  <input
                    name="password"
                    type={showPass ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange}
                    placeholder="Min. 8 characters"
                    className="input-field pr-12"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(p => !p)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-lg leading-none"
                    style={{ color: 'var(--text-muted)' }}
                    tabIndex={-1}
                  >
                    {showPass ? '🙈' : '👁️'}
                  </button>
                </div>
                {form.password.length > 0 && (
                  <div className="flex gap-1 mt-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="flex-1 h-1 rounded-full transition-all"
                        style={{ background: i <= strength ? strengthColors[strength] : 'var(--border)' }} />
                    ))}
                  </div>
                )}
              </div>

              {/* Terms checkbox */}
              <label className="flex items-start gap-3 rounded-xl p-3 cursor-pointer"
                style={{ border: '1px solid var(--border)', background: 'rgba(255,255,255,0.03)' }}>
                <input
                  type="checkbox"
                  name="acceptTerms"
                  checked={form.acceptTerms}
                  onChange={handleChange}
                  className="mt-1 shrink-0"
                />
                <span className="text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                  I agree to the{' '}
                  <Link to="/policies/terms"      className="hover:text-purple-300" style={{ color: 'var(--purple-light)' }}>Terms of Service</Link>,{' '}
                  <Link to="/policies/privacy"    className="hover:text-purple-300" style={{ color: 'var(--purple-light)' }}>Privacy Policy</Link>,{' '}
                  <Link to="/policies/community"  className="hover:text-purple-300" style={{ color: 'var(--purple-light)' }}>Community Guidelines</Link>,{' '}
                  <Link to="/policies/cookies"    className="hover:text-purple-300" style={{ color: 'var(--purple-light)' }}>Cookies</Link>,{' '}
                  <Link to="/policies/content"    className="hover:text-purple-300" style={{ color: 'var(--purple-light)' }}>Content Policy</Link>, and{' '}
                  <Link to="/policies/copyright"  className="hover:text-purple-300" style={{ color: 'var(--purple-light)' }}>Copyright</Link>.
                </span>
              </label>

              {/* Cloudflare Turnstile Captcha */}
              <TurnstileWidget
                onVerify={(token) => { setCaptchaToken(token); setError(''); }}
                onError={() => setError('Captcha failed. Please refresh and try again.')}
              />

              <button type="submit" disabled={loading} className="btn-primary w-full py-3.5 mt-2">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-white/20 inline-block"
                      style={{ borderTopColor: 'white', animation: 'spin 0.8s linear infinite' }} />
                    Creating account...
                  </span>
                ) : '✦ Create Account'}
              </button>
            </form>

            <div className="mt-5 text-center">
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Already a shayar?{' '}
                <Link to="/login" className="font-semibold hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--purple-light)' }}>Sign in</Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
