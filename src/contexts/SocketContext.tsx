import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useLocation } from 'react-router-dom';
import {
  FRONTEND_ONLY_MODE,
  getRequiredApiBaseUrl,
  getTechnicianToken,
  getUserToken,
} from '@/lib/api';
import { logLiveTrackingDiagnostic } from '@/lib/liveTrackingDiagnostics';
import { useTechnicianAuth } from './TechnicianAuthContext';
import { useAuth } from './AuthContext';
import { toast } from 'sonner';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export const useSocket = () => useContext(SocketContext);

const isTechnicianPortalPath = (pathname: string) =>
  pathname === '/active-job' ||
  pathname.startsWith('/active-job/') ||
  pathname === '/technician' ||
  pathname.startsWith('/technician/');

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { technician, isAuthenticated: isTechAuth } = useTechnicianAuth();
  const { user, isAuthenticated: isUserAuth } = useAuth();
  const { pathname } = useLocation();
  const technicianPortal = isTechnicianPortalPath(pathname);
  const socketRole = technicianPortal ? 'technician' : 'user';
  const socketAuthenticated = technicianPortal ? isTechAuth : isUserAuth;
  const socketIdentity = technicianPortal ? technician : user;

  useEffect(() => {
    if (FRONTEND_ONLY_MODE) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setIsConnected(false);
      return;
    }

    // A browser can retain both role sessions. The socket must represent the
    // portal currently being viewed; a customer route must never authenticate
    // as a technician just because that token also exists in local storage.
    if (!socketAuthenticated) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // Initialize socket
    const socketBaseUrl = getRequiredApiBaseUrl();
    const authToken = socketRole === 'technician' ? getTechnicianToken() : getUserToken();
    const diagnosticPrefix = socketRole === 'technician'
      ? '[RT-TECH-SOCKET]'
      : '[RT-CUSTOMER-SOCKET]';
    if (!authToken) {
      setIsConnected(false);
      return;
    }
    const socketInstance = io(socketBaseUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'], // optimize for mobile
      withCredentials: true,
      autoConnect: true,
      auth: { token: authToken },
    });
    logLiveTrackingDiagnostic(diagnosticPrefix, 'socket_connecting', {
      role: socketRole,
      portal: technicianPortal ? 'technician' : 'customer',
    });

    socketInstance.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
      logLiveTrackingDiagnostic(diagnosticPrefix, 'socket_connected', {
        role: socketRole,
        socketId: socketInstance.id ?? null,
      });

      // Join appropriate rooms
      if (socketRole === 'technician' && technician) {
        socketInstance.emit('join_technician_room', technician.id, (ack: { ok?: boolean; code?: string }) => {
          logLiveTrackingDiagnostic(diagnosticPrefix, 'room_join', {
            role: socketRole, roomIdentityId: technician.id, ok: Boolean(ack?.ok), code: ack?.code ?? null,
          });
        });
      } else if (socketRole === 'user' && user) {
        socketInstance.emit('join_user_room', user.id, (ack: { ok?: boolean; code?: string }) => {
          logLiveTrackingDiagnostic(diagnosticPrefix, 'room_join', {
            role: socketRole, roomIdentityId: user.id, ok: Boolean(ack?.ok), code: ack?.code ?? null,
          });
        });
      }
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('Socket disconnected');
      setIsConnected(false);
      logLiveTrackingDiagnostic(diagnosticPrefix, 'socket_disconnected', { role: socketRole, reason });
    });

    socketInstance.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
      logLiveTrackingDiagnostic(diagnosticPrefix, 'socket_connect_error', {
        role: socketRole, message: err?.message || 'unknown',
      });
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [socketAuthenticated, socketIdentity?.id, socketRole]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
