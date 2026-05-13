import { useEffect, useCallback } from 'react';

const DRAFT_KEY = 'shayerigram_post_draft';

/**
 * Autosave draft to localStorage with 1.5s debounce.
 * Draft cleared on successful post submit.
 */
export const useDraftAutosave = (data, enabled = true) => {
  const save = useCallback(() => {
    if (!enabled) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...data, savedAt: Date.now() }));
    } catch {}
  }, [data, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(save, 1500);
    return () => clearTimeout(timer);
  }, [save, enabled]);
};

export const loadDraft = () => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw);
    // Expire drafts older than 7 days
    if (Date.now() - draft.savedAt > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return draft;
  } catch { return null; }
};

export const clearDraft = () => {
  try { localStorage.removeItem(DRAFT_KEY); } catch {}
};
