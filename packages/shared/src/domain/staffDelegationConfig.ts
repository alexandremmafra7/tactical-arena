export interface StaffDelegationConfig {
  // Escalação e Elenco
  autoLineup: 'manual' | 'best_eleven' | 'balanced_rotation' | 'rest_tired';
  autoSubstitutionsInMatch: boolean; // if true, assistant manager auto-replaces injured/fatigued players without stalling
  autoAssignRoles: boolean; // captain, penalty, free kick auto-assigned by assistant
  delegateTeamTalks?: boolean; // if true, assistant manager conducts pre-match and half-time team talks automatically

  // Mercado e Contratos
  scoutingAutomation: 'manual' | 'director_recommendations' | 'auto_shortlist';
  contractRenewals: 'manual' | 'director_handles_routine' | 'notify_only_key_players';
  youthPromotions: 'manual' | 'auto_promote_high_potential';

  // Treinos e Condição Física
  trainingRegime: 'simple_preset' | 'auto_fitness_coach' | 'individual_attributes';
  injuryRehab: 'auto_fastest' | 'auto_balanced' | 'manual_medical_clinic';

  // Mídia e Coletivas
  pressConferences?: 'manual' | 'delegated';

  // Preset Global Rápido
  presetMode: 'brasfoot_casual' | 'balanced' | 'football_manager_hardcore' | 'custom';
}

export const STAFF_DELEGATION_PRESETS: Record<
  Exclude<StaffDelegationConfig['presetMode'], 'custom'>,
  Omit<StaffDelegationConfig, 'presetMode'>
> = {
  brasfoot_casual: {
    autoLineup: 'best_eleven',
    autoSubstitutionsInMatch: true,
    autoAssignRoles: true,
    delegateTeamTalks: true,
    scoutingAutomation: 'auto_shortlist',
    contractRenewals: 'director_handles_routine',
    youthPromotions: 'auto_promote_high_potential',
    trainingRegime: 'simple_preset',
    injuryRehab: 'auto_fastest',
    pressConferences: 'delegated',
  },
  balanced: {
    autoLineup: 'balanced_rotation',
    autoSubstitutionsInMatch: true,
    autoAssignRoles: true,
    delegateTeamTalks: true,
    scoutingAutomation: 'director_recommendations',
    contractRenewals: 'notify_only_key_players',
    youthPromotions: 'auto_promote_high_potential',
    trainingRegime: 'auto_fitness_coach',
    injuryRehab: 'auto_balanced',
    pressConferences: 'delegated',
  },
  football_manager_hardcore: {
    autoLineup: 'manual',
    autoSubstitutionsInMatch: false,
    autoAssignRoles: false,
    delegateTeamTalks: false,
    scoutingAutomation: 'manual',
    contractRenewals: 'manual',
    youthPromotions: 'manual',
    trainingRegime: 'individual_attributes',
    injuryRehab: 'manual_medical_clinic',
    pressConferences: 'manual',
  },
};

export const DEFAULT_STAFF_DELEGATION_CONFIG: StaffDelegationConfig = {
  ...STAFF_DELEGATION_PRESETS.brasfoot_casual,
  presetMode: 'brasfoot_casual',
};

export function getStaffDelegationPreset(
  mode: 'brasfoot_casual' | 'balanced' | 'football_manager_hardcore',
): StaffDelegationConfig {
  return {
    ...STAFF_DELEGATION_PRESETS[mode],
    presetMode: mode,
  };
}

export function detectStaffDelegationPresetMode(
  config: Omit<StaffDelegationConfig, 'presetMode'>,
): StaffDelegationConfig['presetMode'] {
  const modes: Exclude<StaffDelegationConfig['presetMode'], 'custom'>[] = [
    'brasfoot_casual',
    'balanced',
    'football_manager_hardcore',
  ];

  for (const mode of modes) {
    const preset = STAFF_DELEGATION_PRESETS[mode];
    const isMatch = (Object.keys(preset) as (keyof typeof preset)[]).every(
      (key) => config[key] === preset[key],
    );
    if (isMatch) return mode;
  }
  return 'custom';
}