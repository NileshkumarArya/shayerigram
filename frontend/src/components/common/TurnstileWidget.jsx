import { useEffect, useRef } from 'react';

/**
 * Cloudflare Turnstile Captcha Widget
 * Free, privacy-friendly, no user interaction needed (invisible mode)
 *
 * Setup:
 * 1. Go to dash.cloudflare.com → Turnstile → Add site
 * 2. Get your SITE KEY
 * 3. Add to .env: VITE_TURNSTILE_SITE_KEY=your_site_key
 * 4. Add to backend .env: TURNSTILE_SECRET_KEY=your_secret_key
 */
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

export default function TurnstileWidget({ onVerify, onError }) {
  const containerRef = useRef(null);
  const widgetIdRef  = useRef(null);

  useEffect(() => {
    if (!SITE_KEY) {
      // No site key configured — skip captcha in dev
      onVerify?.('dev-bypass');
      return;
    }

    const render = () => {
      if (!containerRef.current || widgetIdRef.current !== null) return;
      widgetIdRef.current = window.turnstile?.render(containerRef.current, {
        sitekey:  SITE_KEY,
        theme:    'dark',
        callback: (token) => onVerify?.(token),
        'error-callback': () => onError?.('Captcha failed. Please try again.'),
      });
    };

    if (window.turnstile) {
      render();
    } else {
      // Load Turnstile script once
      if (!document.getElementById('cf-turnstile-script')) {
        const script = document.createElement('script');
        script.id  = 'cf-turnstile-script';
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
        script.async = true;
        script.defer = true;
        script.onload = render;
        document.head.appendChild(script);
      } else {
        setTimeout(render, 500);
      }
    }

    return () => {
      if (widgetIdRef.current !== null) {
        window.turnstile?.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, []);

  if (!SITE_KEY) return null; // Hidden in dev

  return <div ref={containerRef} className="mt-2" />;
}
