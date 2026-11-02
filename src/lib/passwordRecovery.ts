import { apiUrl, FRONTEND_ONLY_MODE, getUserToken, getTechnicianToken } from './api';
export type RecoveryRole = 'user' | 'technician';

export async function recoveryRequest(role: RecoveryRole, action: string, body?: Record<string, string>, authenticated = false) {
  if (FRONTEND_ONLY_MODE) throw new Error('Password recovery requires the connected ResQNow service. It is unavailable in demo mode.');
  const token = authenticated ? (role === 'technician' ? getTechnicianToken() : getUserToken()) : null;
  if (authenticated && !token) throw new Error('Please sign in again.');
  let response: Response;
  try {
    response = await fetch(apiUrl(`/api/password-recovery/${role}/${action}`), {
      method: body ? 'POST' : 'GET', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch { throw new Error('Could not connect. Check your connection and try again.'); }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'The request could not be completed. Please try again.');
  return result;
}
