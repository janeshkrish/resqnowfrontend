import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { apiUrl } from '@/lib/api';
import { classifyTrafficSource } from '@/utils/trafficSource';

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

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

export function resolveLoggedInVisitor() {
  if (typeof window === 'undefined') return null;
  try {
    // 1. Customer profile
    const userRaw = localStorage.getItem('resqnow_user_profile');
    if (userRaw) {
      const u = JSON.parse(userRaw);
      if (u && (u.email || u.name || u.phone)) {
        return {
          userName: u.name || null,
          userEmail: u.email || null,
          userPhone: u.phone || null,
          userRole: 'customer',
        };
      }
    }

    // 2. Technician profile
    const techRaw = localStorage.getItem('resqnow_technician');
    if (techRaw) {
      const t = JSON.parse(techRaw);
      if (t && (t.email || t.name || t.phone || t.fullName)) {
        return {
          userName: t.name || t.fullName || null,
          userEmail: t.email || null,
          userPhone: t.phone || null,
          userRole: 'technician',
        };
      }
    }

    // 3. Admin user
    const adminRaw = localStorage.getItem('resqnow_admin_user');
    if (adminRaw) {
      const a = JSON.parse(adminRaw);
      if (a && a.email) {
        return {
          userName: a.name || 'Admin',
          userEmail: a.email || null,
          userPhone: null,
          userRole: 'admin',
        };
      }
    }
  } catch {}
  return null;
}

function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem('resqnow_user_token') ||
    localStorage.getItem('token') ||
    localStorage.getItem('resqnow_technician_token') ||
    null
  );
}

interface PageState {
  visitId: string;
  path: string;
  previousPage: string;
  startTime: number;
}

export function PageVisitTracker() {
  const location = useLocation();
  const sessionIdRef = useRef<string>(getOrCreateSessionId());
  const currentPageRef = useRef<PageState | null>(null);
  const initialReferrerRef = useRef<string>(typeof document !== 'undefined' ? document.referrer : '');

  const sendPayload = (payload: Record<string, unknown>, useBeaconOnly = false) => {
    try {
      const endpoint = apiUrl('/api/page-visits');
      const body = JSON.stringify(payload);
      const token = getAuthToken();

      if (useBeaconOnly && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        const blob = new Blob([body], { type: 'application/json' });
        const success = navigator.sendBeacon(endpoint, blob);
        if (success) return;
      }

      if (typeof fetch === 'function') {
        fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // Fail silently
    }
  };

  const finalizeCurrentVisit = (page: PageState, forcedTimeSpent?: number) => {
    try {
      const now = Date.now();
      const timeSpentSeconds =
        typeof forcedTimeSpent === 'number'
          ? Math.max(0, Math.round(forcedTimeSpent))
          : Math.max(0, Math.round((now - page.startTime) / 1000));

      const visitor = resolveLoggedInVisitor();
      sendPayload(
        {
          id: page.visitId,
          page_visited: page.path,
          previous_page: page.previousPage,
          session_id: sessionIdRef.current,
          time_spent_seconds: timeSpentSeconds,
          user_name: visitor?.userName,
          user_email: visitor?.userEmail,
          user_phone: visitor?.userPhone,
          user_role: visitor?.userRole,
        },
        true // Prefer beacon when finalizing/leaving
      );
    } catch {
      // Fail silently
    }
  };

  useEffect(() => {
    const rawPath = `${location.pathname}${location.search || ''}`;

    // Skip tracking /admin/* routes
    if (location.pathname.startsWith('/admin')) {
      if (currentPageRef.current) {
        finalizeCurrentVisit(currentPageRef.current);
      }
      currentPageRef.current = null;
      return;
    }

    // 1. Finalize previous page if navigating internally
    let previousPageLabel = 'direct';
    if (currentPageRef.current) {
      const prevPath = currentPageRef.current.path;
      finalizeCurrentVisit(currentPageRef.current);
      previousPageLabel = classifyTrafficSource({
        previousInternalPath: prevPath,
        currentUrl: typeof window !== 'undefined' ? window.location.href : rawPath,
      });
    } else {
      // First page of session: classify using referrer + current URL
      previousPageLabel = classifyTrafficSource({
        referrer: initialReferrerRef.current,
        currentUrl: typeof window !== 'undefined' ? window.location.href : rawPath,
      });
    }

    // 2. Start new visit
    const visitId = generateUuid();
    currentPageRef.current = {
      visitId,
      path: rawPath,
      previousPage: previousPageLabel,
      startTime: Date.now(),
    };

    // 3. Immediately record entry ping so it appears in live admin panel instantly!
    const visitor = resolveLoggedInVisitor();
    sendPayload({
      id: visitId,
      page_visited: rawPath,
      previous_page: previousPageLabel,
      session_id: sessionIdRef.current,
      time_spent_seconds: 0,
      user_name: visitor?.userName,
      user_email: visitor?.userEmail,
      user_phone: visitor?.userPhone,
      user_role: visitor?.userRole,
    });
  }, [location.pathname, location.search]);

  useEffect(() => {
    const handleLeave = () => {
      if (currentPageRef.current) {
        finalizeCurrentVisit(currentPageRef.current);
      }
    };

    const handleVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'hidden') {
        handleLeave();
      } else if (document.visibilityState === 'visible' && currentPageRef.current) {
        // Tab restored: reset timer
        currentPageRef.current.startTime = Date.now();
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
