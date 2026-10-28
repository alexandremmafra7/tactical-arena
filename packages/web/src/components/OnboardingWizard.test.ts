import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getStaffDelegationPreset } from '@tactical-arena/shared';
import {
  claimClub,
  createNewSave,
  foundClub,
  listAvailableClubs,
  updateStaffDelegationConfig,
} from '../api/client.js';
import { completeCareerOnboarding } from './OnboardingWizard.js';

const wizardSource = readFileSync(
  fileURLToPath(new URL('./OnboardingWizard.tsx', import.meta.url)),
  'utf8',
);

describe('OnboardingWizard focus lifecycle', () => {
  it('moves focus to the stage heading after presentation navigation', () => {
    expect(wizardSource).toContain('stageHeadingRef.current?.focus()');
    expect(wizardSource).toContain('tabIndex={-1}');
  });

  it('focuses the first invalid field', () => {
    expect(wizardSource).toContain(
      "querySelector<HTMLElement>('[aria-invalid=\"true\"]')?.focus()",
    );
    expect(wizardSource).toContain('focusFirstInvalidField();');
  });
});

describe('OnboardingWizard manager quiz', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('game_network_mode', 'offline');
  });

  it('shows the quiz CTA and the selected profile tag', () => {
    expect(wizardSource).toContain(
      'Descobrir meu estilo (Quiz da Diretoria)',
    );
    expect(wizardSource).toContain('Perfil de comando:');
    expect(wizardSource).toContain(
      'DELEGATION_PROFILE_LABELS[delegationPreset]',
    );
  });

  it('persists the selected preset after claiming a club', async () => {
    const selected = (await listAvailableClubs('BRA', 1))[0];
    expect(selected).toBeDefined();

    const saveResult = await createNewSave({
      managerFirstName: 'Ada',
      managerLastName: 'Lovelace',
    });
    const claimed = await completeCareerOnboarding({
      saveResult,
      delegationPreset: 'football_manager_hardcore',
      createClub: () => claimClub(selected!.id),
    });

    expect(claimed.club.staffDelegationConfig).toEqual(
      getStaffDelegationPreset('football_manager_hardcore'),
    );
  });

  it('persists the selected preset after founding a club', async () => {
    const saveResult = await createNewSave({
      managerFirstName: 'Ada',
      managerLastName: 'Lovelace',
    });
    const founded = await completeCareerOnboarding({
      saveResult,
      delegationPreset: 'balanced',
      createClub: () =>
        foundClub({
          name: 'Quiz FC',
          country: 'BRA',
          citySize: 'SMALL',
        }),
    });

    expect(founded.club.staffDelegationConfig).toEqual(
      getStaffDelegationPreset('balanced'),
    );
  });

  it('does not complete the career if delegation persistence fails', async () => {
    await expect(
      completeCareerOnboarding(
        {
          saveResult: {
            save: {} as never,
            token: 'token',
            userId: 'user',
          },
          delegationPreset: 'balanced',
          createClub: async () => ({ id: 'club-1' }) as never,
        },
        vi.fn().mockRejectedValue(new Error('falha ao salvar perfil')),
      ),
    ).rejects.toThrow('falha ao salvar perfil');
  });

  it('uses the shared preset builder before persistence', async () => {
    const persisted = vi.fn<typeof updateStaffDelegationConfig>(
      async (_clubId, config) =>
        ({ id: 'club-1', staffDelegationConfig: config }) as never,
    );

    await completeCareerOnboarding(
      {
        saveResult: {
          save: {} as never,
          token: 'token',
          userId: 'user',
        },
        delegationPreset: 'brasfoot_casual',
        createClub: async () => ({ id: 'club-1' }) as never,
      },
      persisted,
    );

    expect(persisted).toHaveBeenCalledWith(
      'club-1',
      getStaffDelegationPreset('brasfoot_casual'),
    );
  });
});
