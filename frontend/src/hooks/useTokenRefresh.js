import { useEffect } from 'react';
import { getAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

const useTokenRefresh = (intervalMinutes = 55) => {
  useEffect(() => {
    const auth = getAuth();

    const refreshToken = async () => {
      const user = auth.currentUser;
      if (user) {
        try {
          const token = await user.getIdToken(true); // force refresh
          await AsyncStorage.setItem('token', token); // optionally store token
          console.log('Token refreshed');
        } catch (error) {
          console.error('Token refresh failed:', error);
        }
      }
    };

    const interval = setInterval(refreshToken, intervalMinutes * 60 * 1000);

    // Immediately refresh once when mounted
    refreshToken();

    return () => clearInterval(interval);
  }, [intervalMinutes]);
};

export default useTokenRefresh;