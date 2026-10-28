import React, { createContext, useContext, useState, useCallback } from 'react';

export interface CutsceneOptions {
  type: 'primeiro-contrato' | 'campeao' | 'contratacao-galactica' | 'joia-da-base' | 'subimos' | 'rescisao' | 'aposentadoria';
  club?: any;
  competition?: string;
  data?: {
    managerName?: string;
    salary?: number;
    playerName?: string;
    playerOverall?: number;
    playerPosition?: string;
    divisionName?: string;
    message?: string;
  };
  onComplete?: () => void;
}

interface CutsceneContextType {
  playCutscene: (options: CutsceneOptions) => void;
  currentCutscene: CutsceneOptions | null;
  closeCutscene: () => void;
}

export const CutsceneContext = createContext<CutsceneContextType | undefined>(undefined);

export const CutsceneProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentCutscene, setCurrentCutscene] = useState<CutsceneOptions | null>(null);

  const playCutscene = useCallback((options: CutsceneOptions) => {
    setCurrentCutscene(options);
  }, []);

  const closeCutscene = useCallback(() => {
    if (currentCutscene?.onComplete) {
      currentCutscene.onComplete();
    }
    setCurrentCutscene(null);
  }, [currentCutscene]);

  return (
    <CutsceneContext.Provider value={{ playCutscene, currentCutscene, closeCutscene }}>
      {children}
    </CutsceneContext.Provider>
  );
};

export const useCutscene = () => {
  const context = useContext(CutsceneContext);
  if (!context) {
    throw new Error('useCutscene must be used within a CutsceneProvider');
  }
  return context;
};
