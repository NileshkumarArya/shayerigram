import { useEffect, useRef, useState } from 'react';

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

export default function TurnstileWidget({ onVerify, onError }) {
  const containerRef = useRef(null);
  const widgetIdRef  = useRef(null);
  const [loaded, setLoaded]     = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    // ✅ No site key — bypass captcha (local dev only). Backend also
    // requires NODE_ENV !== 'production' to accept this token, so it's a
    // no-op even if this somehow ran in a real deployment.
    if (!SITE_KEY) {
      onVerify?.('dev-bypass');
      return;
    }

    let solved = false;

    const render = () => {
      if (!containerRef.current || widgetIdRef.current !== null) return;
      try {
        widgetIdRef.current = window.turnstile?.render(containerRef.current, {
          sitekey:  SITE_KEY,
          theme:    'dark',
          size:     'invisible',
          callback: (token) => {
            solved = true;
            clearTimeout(timeout);
            setLoaded(true);
            onVerify?.(token);
          },
          'error-callback': () => {
            onError?.('Captcha failed. Please refresh and try again.');
          },
          'expired-callback': () => {
            widgetIdRef.current = null;
            render();
          },
        });
      } catch (e) {
        onError?.('Captcha could not load. Please refresh and try again.');
      }
    };

    const loadScript = () => {
      if (window.turnstile) { render(); return; }
      if (!document.getElementById('cf-turnstile-script')) {
        const script = document.createElement('script');
        script.id    = 'cf-turnstile-script';
        script.src   = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.onload  = () => setTimeout(render, 100);
        script.onerror = () => onError?.('Could not reach the captcha service. Check your connection and refresh.');
        document.head.appendChild(script);
      } else {
        setTimeout(render, 500);
      }
    };

    loadScript();

    // Genuine timeout only now — no longer submits a fake token. Cleared the
    // instant a real token arrives (see callback above), so a slow-but-
    // working solve (e.g. user takes >5s filling the rest of the form) can
    // never get silently clobbered by this firing late.
    const timeout = setTimeout(() => {
      if (!solved) {
        setTimedOut(true);
        onError?.('Captcha timed out. Please refresh and try again.');
      }
    }, 8000);

    return () => {
      clearTimeout(timeout);
      if (widgetIdRef.current !== null) {
        window.turnstile?.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, []);

  if (!SITE_KEY) return null;

  return (
    <div>
      <div ref={containerRef} className="mt-2" />
      {loaded && (
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>✓ Security check passed</p>
      )}
      {timedOut && !loaded && (
        <p className="text-xs mt-1" style={{ color: '#f87171' }}>⚠ Captcha timed out — please refresh and try again.</p>
      )}
    </div>
  );
}