import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export function useNetwork() {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    // Initial fetch
    NetInfo.fetch().then((state: NetInfoState) => {
      setIsOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });

    // Subscribe to connection updates
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsOnline(Boolean(state.isConnected && state.isInternetReachable !== false));
    });

    return () => unsubscribe();
  }, []);

  return { isOnline };
}

