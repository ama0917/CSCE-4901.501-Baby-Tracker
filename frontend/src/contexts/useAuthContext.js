import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [childId, setChildId] = useState(null);

  useEffect(() => {
    // Load the child ID from AsyncStorage when the app starts
    AsyncStorage.getItem('child_id').then(setChildId);
  }, []);

  const selectChild = async (id) => {
    setChildId(id);
    await AsyncStorage.setItem('child_id', id);
  };

  const clearSession = async () => {
    setChildId(null);
    await AsyncStorage.removeItem('child_id');
  };

  return (
    <AuthContext.Provider value={{ childId, setChildId, selectChild, clearSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => useContext(AuthContext);
