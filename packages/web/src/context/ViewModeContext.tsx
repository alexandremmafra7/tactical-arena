import React, { createContext, useContext, useState, useEffect } from 'react';

export type ViewMode = 'brasfoot' | 'fm';

interface ViewModeContextType {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  toggleViewMode: () => void;
  isBrasfoot: boolean;
}

const LOCAL_STORAGE_KEY = 'tactical_arena_view_mode';

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

export const ViewModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (typeof localStorage === 'undefined') return 'brasfoot';
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved === 'brasfoot' || saved === 'fm') return saved;
    return 'brasfoot';
  });

  const setViewMode = (mode: ViewMode) => {
    setViewModeState(mode);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, mode);
    }
  };

  const toggleViewMode = () => {
    setViewMode(viewMode === 'brasfoot' ? 'fm' : 'brasfoot');
  };

  const isBrasfoot = viewMode === 'brasfoot';

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode, toggleViewMode, isBrasfoot }}>
      {children}
    </ViewModeContext.Provider>
  );
};

export function useViewMode(): ViewModeContextType {
  const context = useContext(ViewModeContext);
  if (!context) {
    throw new Error('useViewMode deve ser usado dentro de um ViewModeProvider');
  }
  return context;
}
