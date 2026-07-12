import { useEffect, useRef, useState } from 'react';

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

export default function TurnstileWidget({ onVerify, onError }) {
  const containerRef = useRef(null);
  const widgetIdRef  = useRef(null);
  const [status, setStatus] = useState('loading'); // loading | ready | solved | error

  useEffect(() => {
    // ✅ No site key — bypass captcha (local dev only). Backend also
    // requires NODE_ENV !== 'production' to accept this token, so it's a
    // no-op even if this somehow ran in a real deployment.
    if (!SITE_KEY) {
      onVerify?.('dev-bypass');
      return;
    }

    const render = () => {
      if (!containerRef.current || widgetIdRef.current !== null) return;
      try {
        widgetIdRef.current = window.turnstile?.render(containerRef.current, {
          sitekey: SITE_KEY,
          theme:   'dark',
          // Visible managed widget — user completes it directly, so no
          // invisible auto-solve + artificial-timeout-fallback is needed
          size:    'normal',
          callback: (token) => {
            setStatus('solved');
            onVerify?.(token);
          },
          'error-callback': () => {
            setStatus('error');
            onError?.('Captcha failed. Please refresh and try again.');
          },
          'expired-callback': () => {
            setStatus('loading');
            widgetIdRef.current = null;
            render();
          },
        });
        setStatus('ready');
      } catch (e) {
        setStatus('error');
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
        script.onerror = () => {
          setStatus('error');
          onError?.('Could not reach the captcha service. Check your connection and refresh.');
        };
        document.head.appendChild(script);
      } else {
        setTimeout(render, 500);
      }
    };

    loadScript();

    return () => {
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
      {status === 'error' && (
        <p className="text-xs mt-1" style={{ color: '#f87171' }}>
          ⚠ Captcha failed to load —{' '}
          <button type="button" onClick={() => window.location.reload()} className="underline">
            refresh the page
          </button>.
        </p>
      )}
    </div>
  );
}