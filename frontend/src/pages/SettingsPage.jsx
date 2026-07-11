import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { settingsAPI } from '../services/api';
import { useNavigate } from 'react-router-dom';

const Toggle = ({ checked, onChange, disabled }) => (
  <button
    onClick={() => !disabled && onChange(!checked)}
    className={`relative w-12 h-6 rounded-full transition-all duration-300 ${checked ? 'bg-purple-600' : 'bg-white/10'} ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
  </button>
);

// ✅ Custom Dropdown — browser native select ignores CSS on options
const CustomDropdown = ({ value, onChange, options }) => {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);

  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = options.find(o => o.value === value) || options[0];

  return (
    <div ref={ref} className="relative" style={{ minWidth: 170 }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center justify-between gap-2 w-full px-3 py-2 rounded-xl text-sm"
        style={{ background: '#1e1a2e', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-primary)' }}>
        <span>{selected.label}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-full rounded-xl overflow-hidden z-50"
          style={{ background: '#1e1a2e', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
          {options.map(o => (
            <button key={o.value} type="button"
              onClick={() => { onChange(o.value); setOpen(false); }}
              className="flex items-center w-full px-3 py-2.5 text-sm text-left transition-all"
              style={{
                background: o.value === value ? 'rgba(147,51,234,0.2)' : 'transparent',
                color: o.value === value ? '#c084fc' : 'var(--text-primary)',
              }}
              onMouseEnter={e => { if (o.value !== value) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={e => { if (o.value !== value) e.currentTarget.style.background = 'transparent'; }}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const Section = ({ title, icon, children }) => (
  <div className="glass rounded-2xl p-6 mb-4">
    <h2 className="text-base font-semibold mb-5 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
      <span>{icon}</span> {title}
    </h2>
    <div className="space-y-4">{children}</div>
  </div>
);

const Row = ({ label, desc, children }) => (
  <div className="flex items-center justify-between gap-4">
    <div className="flex-1">
      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
      {desc && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</p>}
    </div>
    {children}
  </div>
);

const LICENSE_LABELS = {
  all_rights: '© All Rights Reserved',
  cc_by:      'CC BY — Attribution',
  cc_by_sa:   'CC BY-SA — ShareAlike',
  cc0:        'CC0 — Public Domain',
};

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [settings, setSettings]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState('');
  const [section, setSection]     = useState('privacy');

  const [hasDateOfBirth, setHasDateOfBirth] = useState(true); // assume true till loaded, avoids a flash of the form
  const [dobInput, setDobInput]     = useState('');
  const [savingDob, setSavingDob]   = useState(false);

  // Delete account modal
  const [showDelete, setShowDelete]   = useState(false);
  const [deletePass, setDeletePass]   = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting]       = useState(false);

  useEffect(() => {
    settingsAPI.get().then(({ data }) => {
      setSettings(data.settings);
      setHasDateOfBirth(data.hasDateOfBirth);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSetDob = async () => {
    if (!dobInput) return;
    setSavingDob(true);
    try {
      await settingsAPI.setDateOfBirth({ dateOfBirth: dobInput });
      setHasDateOfBirth(true);
      showToast('✓ Date of birth saved');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to save.');
    } finally {
      setSavingDob(false);
    }
  };

  const update = async (key, value) => {
    const prev = { ...settings };
    setSettings(s => ({ ...s, [key]: value }));
    setSaving(true);
    try {
      await settingsAPI.update({ [key]: value });
      showToast('✓ Saved');
    } catch {
      setSettings(prev);
      showToast('Failed to save');
    }
    setSaving(false);
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return showToast('Type DELETE to confirm');
    setDeleting(true);
    try {
      await settingsAPI.deleteAccount({ password: deletePass, confirmation: deleteConfirm });
      await logout();
      navigate('/');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete account');
    }
    setDeleting(false);
  };

  const handleDeactivate = async () => {
    const pass = prompt('Enter your password to deactivate account:');
    if (!pass) return;
    try {
      await settingsAPI.deactivate({ password: pass });
      await logout();
      navigate('/login');
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to deactivate');
    }
  };

  const NAV = [
    { id: 'privacy',    icon: '🔒', label: 'Privacy' },
    { id: 'notif',      icon: '🔔', label: 'Notifications' },
    { id: 'posting',    icon: '✍️', label: 'Posting' },
    { id: 'poet',       icon: '🪶', label: 'Poet Mode' },
    { id: 'account',    icon: '⚙️', label: 'Account' },
  ];

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-xl text-sm font-medium text-white animate-fade-in"
          style={{ background: 'rgba(147,51,234,0.9)', backdropFilter: 'blur(12px)' }}>
          {toast}
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full flex items-center justify-center glass">
            <span style={{ color: 'var(--text-secondary)' }}>←</span>
          </button>
          <div>
            <h1 className="text-xl font-cinzel font-bold gradient-text">Settings</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Manage your preferences</p>
          </div>
          {saving && <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>Saving...</span>}
        </div>

        {/* Nav tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {NAV.map(n => (
            <button key={n.id} onClick={() => setSection(n.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                section === n.id
                  ? 'text-white' : 'text-gray-400 hover:text-white'
              }`}
              style={section === n.id ? { background: 'var(--gradient-purple)' } : { background: 'rgba(255,255,255,0.05)' }}>
              {n.icon} {n.label}
            </button>
          ))}
        </div>

        {/* ── Privacy ──────────────────────────────────────────────────────── */}
        {section === 'privacy' && settings && (
          <Section title="Privacy Settings" icon="🔒">
            <Row label="Profile Visibility" desc="Who can see your profile">
              <CustomDropdown
  options={[
                { value: 'public',    label: '🌍 Public' },
                { value: 'followers', label: '👥 Followers Only' },
                { value: 'private',   label: '🔒 Private' },
              ]} value={settings.profileVisibility || 'public'} onChange={v => update('profileVisibility', v)} />
            </Row>
            <div className="border-t" style={{ borderColor: 'var(--border)' }} />
            <Row label="Hide from guests" desc="Non-logged-in users can't see your posts">
              <Toggle checked={settings.hideFromGuests} onChange={v => update('hideFromGuests', v)} />
            </Row>
            <Row label="Disable comments" desc="No one can comment on your posts">
              <Toggle checked={settings.disableComments} onChange={v => update('disableComments', v)} />
            </Row>
            <Row label="Allow sharing" desc="Others can share your posts">
              <Toggle checked={settings.allowSharing} onChange={v => update('allowSharing', v)} />
            </Row>
          </Section>
        )}

        {/* ── Notifications ─────────────────────────────────────────────── */}
        {section === 'notif' && settings && (
          <Section title="Notification Settings" icon="🔔">
            <Row label="Likes & reactions" desc="When someone likes your post">
              <Toggle checked={settings.notifyLikes} onChange={v => update('notifyLikes', v)} />
            </Row>
            <Row label="New followers" desc="When someone follows you">
              <Toggle checked={settings.notifyFollows} onChange={v => update('notifyFollows', v)} />
            </Row>
            <Row label="Comments" desc="When someone comments on your post">
              <Toggle checked={settings.notifyComments} onChange={v => update('notifyComments', v)} />
            </Row>
            <Row label="Daily digest" desc="Daily summary of activity">
              <Toggle checked={settings.notifyDigest} onChange={v => update('notifyDigest', v)} />
            </Row>
          </Section>
        )}

        {/* ── Posting ───────────────────────────────────────────────────── */}
        {section === 'posting' && settings && (
          <Section title="Posting & Sharing" icon="✍️">
            <Row label="Auto-save drafts" desc="Automatically save your work">
              <Toggle checked={settings.autosaveDrafts} onChange={v => update('autosaveDrafts', v)} />
            </Row>
            <div className="border-t" style={{ borderColor: 'var(--border)' }} />
            <Row label="Default license" desc="Copyright for your posts">
              <CustomDropdown
                value={settings.defaultLicense || 'all_rights'}
                onChange={v => update('defaultLicense', v)}
                options={Object.entries(LICENSE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
              />
            </Row>
          </Section>
        )}

        {/* ── Poet Mode ─────────────────────────────────────────────────── */}
        {section === 'poet' && settings && (
          <Section title="🪶 Poet Mode" icon="">
            <div className={`rounded-xl p-4 mb-4 transition-all ${settings.poetMode ? 'border border-purple-500/30' : ''}`}
              style={{ background: settings.poetMode ? 'rgba(147,51,234,0.08)' : 'rgba(255,255,255,0.03)' }}>
              <p className="text-sm mb-1 font-medium" style={{ color: 'var(--text-primary)' }}>
                {settings.poetMode ? '✦ Poet Mode Active' : 'Poet Mode Off'}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Minimal UI — focus on writing. Hides distractions, shows writing prompts.
              </p>
            </div>
            <Row label="Enable Poet Mode" desc="Distraction-free writing & reading">
              <Toggle checked={settings.poetMode} onChange={v => update('poetMode', v)} />
            </Row>
            {settings.poetMode && (
              <div className="mt-4 p-4 rounded-xl" style={{ background: 'rgba(147,51,234,0.06)', border: '1px dashed rgba(147,51,234,0.3)' }}>
                <p className="text-xs font-medium mb-3" style={{ color: 'var(--purple-light)' }}>✦ Writing Prompts</p>
                {[
                  'तुम्हारे बिना चाँद भी उदास है...',
                  'जब शब्द दिल से निकलते हैं...',
                  'वो लम्हे जो याद रह जाते हैं...',
                  'दिल की बात कह दो आज...',
                  'आँखों में जो सपने हैं...',
                ].map((p, i) => (
                  <p key={i} className="text-xs py-1.5 border-b last:border-0 italic"
                    style={{ color: 'var(--text-secondary)', borderColor: 'var(--border)' }}>
                    {p}
                  </p>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* ── Account ───────────────────────────────────────────────────── */}
        {section === 'account' && (
          <>
            {!hasDateOfBirth && (
              <div className="glass rounded-2xl p-6 mb-4" style={{ border: '1px solid rgba(245,158,11,0.2)' }}>
                <h2 className="text-base font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>🎂 Set Date of Birth</h2>
                <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                  Your account doesn't have a birth date on file — it was created before this became required.
                  This is needed to view Mature-tagged content, and can only be set once.
                </p>
                <div className="flex gap-2">
                  <input type="date" value={dobInput} onChange={e => setDobInput(e.target.value)}
                    max={new Date(Date.now() - 13 * 365.25 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)}
                    className="input-field text-sm flex-1" />
                  <button onClick={handleSetDob} disabled={savingDob || !dobInput}
                    className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
                    style={{ background: 'var(--gradient-purple)' }}>
                    {savingDob ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            )}

            <Section title="Account Management" icon="⚙️">
              <Row label="Clear cache" desc="Clear locally stored data">
                <button onClick={() => { localStorage.clear(); showToast('Cache cleared ✓'); }}
                  className="text-xs px-3 py-1.5 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)' }}>
                  Clear
                </button>
              </Row>
              <div className="border-t" style={{ borderColor: 'var(--border)' }} />
              <Row label="Deactivate account" desc="Temporarily hide your account">
                <button onClick={handleDeactivate}
                  className="text-xs px-3 py-1.5 rounded-xl" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                  Deactivate
                </button>
              </Row>
            </Section>

            {/* Delete account */}
            <div className="glass rounded-2xl p-6" style={{ border: '1px solid rgba(239,68,68,0.2)' }}>
              <h2 className="text-base font-semibold mb-2 text-red-400">🗑️ Delete Account</h2>
              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
                Permanently delete your account and all posts. This cannot be undone.
              </p>
              {!showDelete ? (
                <button onClick={() => setShowDelete(true)}
                  className="text-sm px-4 py-2 rounded-xl text-red-400"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  Delete my account
                </button>
              ) : (
                <div className="space-y-3">
                  <input type="password" placeholder="Your password"
                    value={deletePass} onChange={e => setDeletePass(e.target.value)}
                    className="input-field text-sm" />
                  <input type="text" placeholder='Type "DELETE" to confirm'
                    value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
                    className="input-field text-sm" />
                  <div className="flex gap-2">
                    <button onClick={() => { setShowDelete(false); setDeletePass(''); setDeleteConfirm(''); }}
                      className="flex-1 py-2 rounded-xl text-sm" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)' }}>
                      Cancel
                    </button>
                    <button onClick={handleDeleteAccount} disabled={deleting || deleteConfirm !== 'DELETE'}
                      className="flex-1 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40"
                      style={{ background: 'rgba(239,68,68,0.8)' }}>
                      {deleting ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
