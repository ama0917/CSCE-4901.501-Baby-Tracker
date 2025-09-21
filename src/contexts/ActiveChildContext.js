import React, { createContext, useContext, useState } from 'react';

const ActiveChildContext = createContext(null);

export function ActiveChildProvider({ children }) {
  const [activeChildId, setActiveChildId] = useState(null);
  const [activeChildName, setActiveChildName] = useState(null);

  return (
    <ActiveChildContext.Provider value={{ activeChildId, setActiveChildId, activeChildName, setActiveChildName }}>
      {children}
    </ActiveChildContext.Provider>
  );
}

export function useActiveChild() {
  const ctx = useContext(ActiveChildContext);
  if (!ctx) {
    throw new Error('useActiveChild must be used within an ActiveChildProvider');
  }
  return ctx;
}

export default ActiveChildContext;
