import { useState, useEffect } from 'react';

const CACHE_KEY = 'cognix_saying';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CachedSaying {
  text: string;
  ts: number;
}

interface SayingState {
  text: string;
  loading: boolean;
}

function getCached(): string | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: CachedSaying = JSON.parse(raw);
    if (Date.now() - cached.ts > CACHE_TTL) return null; // expired
    return cached.text || null;
  } catch {
    return null;
  }
}

function setCache(text: string) {
  localStorage.setItem(CACHE_KEY, JSON.stringify({ text, ts: Date.now() }));
}

/**
 * Fetch a random saying from the 一言 API.
 * Caches in localStorage for 5 minutes.
 */
export function useSaying(): SayingState {
  const [state, setState] = useState<SayingState>(() => {
    const cached = getCached();
    return cached ? { text: cached, loading: false } : { text: '', loading: true };
  });

  useEffect(() => {
    const cached = getCached();
    if (cached) {
      setState({ text: cached, loading: false });
      return;
    }

    const controller = new AbortController();
    fetch('https://uapis.cn/api/v1/saying', { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        if (data?.text) {
          setCache(data.text);
          setState({ text: data.text, loading: false });
        } else {
          setState({ text: '', loading: false });
        }
      })
      .catch(() => {
        setState({ text: '', loading: false });
      });

    return () => controller.abort();
  }, []);

  return state;
}
