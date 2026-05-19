import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

let socketInstance = null;

export const useSocket = (onNotification) => {
  const { user } = useAuth();
  const callbackRef = useRef(onNotification);
  callbackRef.current = onNotification;

  useEffect(() => {
    if (!user) {
      if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
      }
      return;
    }

    if (!socketInstance) {
      const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

      socketInstance = io(SOCKET_URL, {
        withCredentials: true,
        // ✅ FIX: polling pehle — cross-domain cookies polling mein kaam karte hain
        // WebSocket upgrade baad mein hoti hai automatically
        transports: ['polling', 'websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1500,
        reconnectionDelayMax: 7000,
        timeout: 10000,
      });
    }

    const socket = socketInstance;

    socket.on('connect', () => {
      console.log('[Socket] Connected:', socket.id);
    });

    socket.on('notification', (data) => {
      window.dispatchEvent(new CustomEvent('sg:notification', { detail: data }));
      callbackRef.current?.(data);
    });

    socket.on('reconnect', () => {
      console.log('[Socket] Reconnected');
    });

    socket.on('disconnect', (reason) => {
      console.warn('[Socket] Disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });

    return () => {
      socket.off('notification');
      socket.off('reconnect');
      socket.off('disconnect');
      socket.off('connect_error');
    };
  }, [user?._id]);

  return socketInstance;
};

export default useSocket;