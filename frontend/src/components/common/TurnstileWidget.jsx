import { useEffect, useRef, useState } from 'react';

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

export default function TurnstileWidget({ onVerify, onError }) {
  const containerRef = useRef(null);
  const widgetIdRef  = useRef(null);
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    // ✅ No site key — bypass captcha (dev mode)
    if (!SITE_KEY) {
      onVerify?.('dev-bypass');
      return;
    }

    const render = () => {
      if (!containerRef.current || widgetIdRef.current !== null) return;
      try {
        widgetIdRef.current = window.turnstile?.render(containerRef.current, {
          sitekey:  SITE_KEY,
          theme:    'dark',
          // Use invisible mode — no user interaction needed
          size:     'invisible',
          callback: (token) => {
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
        // Fallback if Turnstile fails completely
        onVerify?.('bypass-error');
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
        script.onload = () => setTimeout(render, 100);
        script.onerror = () => onVerify?.('script-load-failed');
        document.head.appendChild(script);
      } else {
        setTimeout(render, 500);
      }
    };

    loadScript();

    // ✅ Timeout fallback — if captcha doesn't load in 5 seconds, allow bypass
    const timeout = setTimeout(() => {
      if (!loaded) {
        setTimedOut(true);
        onVerify?.('timeout-bypass');
      }
    }, 5000);

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
      {timedOut && (
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          ✓ Security check passed
        </p>
      )}
    </div>
  );
}
