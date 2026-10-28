import { describe, expect, it } from 'vitest';
import {
  DEFAULT_STAFF_DELEGATION_CONFIG,
  STAFF_DELEGATION_PRESETS,
  detectStaffDelegationPresetMode,
  getStaffDelegationPreset,
} from './staffDelegationConfig.js';

describe('StaffDelegationConfig', () => {
  it('has sensible default config initialized to brasfoot_casual', () => {
    expect(DEFAULT_STAFF_DELEGATION_CONFIG.presetMode).toBe('brasfoot_casual');
    expect(DEFAULT_STAFF_DELEGATION_CONFIG.autoSubstitutionsInMatch).toBe(true);
    expect(DEFAULT_STAFF_DELEGATION_CONFIG.autoLineup).toBe('best_eleven');
    expect(DEFAULT_STAFF_DELEGATION_CONFIG.autoAssignRoles).toBe(true);
    expect(DEFAULT_STAFF_DELEGATION_CONFIG.delegateTeamTalks).toBe(true);
  });

  it('provides exact presets for all modes', () => {
    const casual = getStaffDelegationPreset('brasfoot_casual');
    expect(casual.autoSubstitutionsInMatch).toBe(true);
    expect(casual.scoutingAutomation).toBe('auto_shortlist');
    expect(casual.delegateTeamTalks).toBe(true);

    const balanced = getStaffDelegationPreset('balanced');
    expect(balanced.autoLineup).toBe('balanced_rotation');
    expect(balanced.contractRenewals).toBe('notify_only_key_players');
    expect(balanced.delegateTeamTalks).toBe(true);

    const fm = getStaffDelegationPreset('football_manager_hardcore');
    expect(fm.autoSubstitutionsInMatch).toBe(false);
    expect(fm.autoLineup).toBe('manual');
    expect(fm.trainingRegime).toBe('individual_attributes');
    expect(fm.delegateTeamTalks).toBe(false);
  });

  it('detects preset mode correctly', () => {
    expect(detectStaffDelegationPresetMode(STAFF_DELEGATION_PRESETS.brasfoot_casual)).toBe('brasfoot_casual');
    expect(detectStaffDelegationPresetMode(STAFF_DELEGATION_PRESETS.balanced)).toBe('balanced');
    expect(detectStaffDelegationPresetMode(STAFF_DELEGATION_PRESETS.football_manager_hardcore)).toBe(
      'football_manager_hardcore',
    );

    const custom = {
      ...STAFF_DELEGATION_PRESETS.brasfoot_casual,
      autoSubstitutionsInMatch: false,
    };
    expect(detectStaffDelegationPresetMode(custom)).toBe('custom');
  });
});
