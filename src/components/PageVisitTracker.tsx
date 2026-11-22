import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { apiUrl } from '@/lib/api';
import { classifyTrafficSource } from '@/utils/trafficSource';

function getOrCreateSessionId(): string {
  try {
    let sid = sessionStorage.getItem('resqnow_session_id');
    if (!sid) {
      sid = `s_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
      sessionStorage.setItem('resqnow_session_id', sid);
    }
    return sid;
  } catch {
    return `s_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
  }
}

interface PageState {
  path: string;
  previousPage: string;
  startTime: number;
  flushed: boolean;
}

export function PageVisitTracker() {
  const location = useLocation();
  const sessionIdRef = useRef<string>(getOrCreateSessionId());
  const currentPageRef = useRef<PageState | null>(null);
  const initialReferrerRef = useRef<string>(typeof document !== 'undefined' ? document.referrer : '');

  const sendVisitBeacon = (page: PageState, forcedTimeSpent?: number) => {
    if (page.flushed) return;
    page.flushed = true;

    try {
      const now = Date.now();
      const timeSpentSeconds =
        typeof forcedTimeSpent === 'number'
          ? Math.max(0, Math.round(forcedTimeSpent))
          : Math.max(0, Math.round((now - page.startTime) / 1000));

      const payload = {
        page_visited: page.path,
        previous_page: page.previousPage,
        session_id: sessionIdRef.current,
        time_spent_seconds: timeSpentSeconds,
      };

      const endpoint = apiUrl('/api/page-visits');
      const body = JSON.stringify(payload);

      let beaconSent = false;
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([body], { type: 'application/json' });
        beaconSent = navigator.sendBeacon(endpoint, blob);
      }

      if (!beaconSent && typeof fetch === 'function') {
        fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // Fail silently: tracking must never impact user experience
    }
  };

  useEffect(() => {
    const rawPath = `${location.pathname}${location.search || ''}`;

    // Skip /admin/* routes
    if (location.pathname.startsWith('/admin')) {
      if (currentPageRef.current && !currentPageRef.current.flushed) {
        sendVisitBeacon(currentPageRef.current);
      }
      currentPageRef.current = null;
      return;
    }

    // Flush previous page visit if exists
    let previousPageLabel = 'direct';
    if (currentPageRef.current) {
      const prevPath = currentPageRef.current.path;
      sendVisitBeacon(currentPageRef.current);
      previousPageLabel = classifyTrafficSource({
        previousInternalPath: prevPath,
        currentUrl: typeof window !== 'undefined' ? window.location.href : rawPath,
      });
    } else {
      // First page of session: classify using initial referrer + URL
      previousPageLabel = classifyTrafficSource({
        referrer: initialReferrerRef.current,
        currentUrl: typeof window !== 'undefined' ? window.location.href : rawPath,
      });
    }

    currentPageRef.current = {
      path: rawPath,
      previousPage: previousPageLabel,
      startTime: Date.now(),
      flushed: false,
    };
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handleLeave = () => {
      if (currentPageRef.current && !currentPageRef.current.flushed) {
        sendVisitBeacon(currentPageRef.current);
      }
    };

    const handleVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'hidden') {
        handleLeave();
      } else if (document.visibilityState === 'visible' && currentPageRef.current) {
        // If returning to tab, reset timer and mark un-flushed for subsequent leave
        currentPageRef.current.startTime = Date.now();
        currentPageRef.current.flushed = false;
      }
    };

    window.addEventListener('pagehide', handleLeave);
    window.addEventListener('beforeunload', handleLeave);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pagehide', handleLeave);
      window.removeEventListener('beforeunload', handleLeave);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      handleLeave();
    };
  }, []);

  return null;
}
