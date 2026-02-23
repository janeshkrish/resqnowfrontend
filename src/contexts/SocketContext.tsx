import React, { createContext, useContext, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getRequiredApiBaseUrl } from '@/lib/api';
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

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const { technician, isAuthenticated: isTechAuth } = useTechnicianAuth();
  const { user, isAuthenticated: isUserAuth } = useAuth();

  useEffect(() => {
    // Only connect if either technician or user is authenticated
    if (!isTechAuth && !isUserAuth) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    // Initialize socket
    const socketBaseUrl = getRequiredApiBaseUrl();
    const socketInstance = io(socketBaseUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'], // optimize for mobile
      withCredentials: true,
      autoConnect: true,
    });

    socketInstance.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);

      // Join appropriate rooms
      if (isTechAuth && technician) {
        socketInstance.emit('join_technician_room', technician.id);
      }

      if (isUserAuth && user) {
        socketInstance.emit('join_user_room', user.id);
      }
    });

    socketInstance.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    socketInstance.on('connect_error', (err) => {
      console.error('Socket connection error:', err);
    });

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [isTechAuth, technician?.id, isUserAuth, user?.id]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
