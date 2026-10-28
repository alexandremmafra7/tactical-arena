import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const modalSource = readFileSync(join(__dirname, 'StartSubmenuModal.tsx'), 'utf-8');

describe('StartSubmenuModal source contract', () => {
  it('never creates a save, claims, or founds a club directly — OnboardingWizard is the sole writer', () => {
    expect(modalSource).not.toContain('createNewSave(');
    expect(modalSource).not.toContain('claimClub(');
    expect(modalSource).not.toContain('foundClub(');
  });

  it('delegates creation to the wizard and authenticates its result', () => {
    expect(modalSource).toContain('<OnboardingWizard');
    expect(modalSource).toContain('onCompleted={handleWizardCompleted}');
    expect(modalSource).toContain('signIn(result.token, result.userId)');
    expect(modalSource).toContain('onNewCareer(result)');
  });

  it('requires the career callbacks', () => {
    expect(modalSource).toContain('onNewCareer: (result: CreateCareerResult) => void;');
    expect(modalSource).toContain('onLoadCareer: (saveId: string) => void;');
    expect(modalSource).not.toContain('onNewCareer?:');
    expect(modalSource).not.toContain('onLoadCareer?:');
  });

  it('traps focus and exposes complete dialog semantics', () => {
    expect(modalSource).toContain('trapFocus(dialogRef.current)');
    expect(modalSource).toContain('dialogRef');
    expect(modalSource).toContain('aria-modal="true"');
    expect(modalSource).toContain('aria-labelledby="career-hub-title"');
  });

  it('does not close the career hub when a nested dialog handles Escape', () => {
    expect(modalSource).toContain("e.key === 'Escape' && dialogRef.current?.contains(e.target as Element)");
  });

  it('makes club identity primary with a reusable crest', () => {
    expect(modalSource).toContain('<ClubCrest');
    expect(modalSource).toContain('career-club-identity');
  });

  it('shows the four operational facts used to scan a career', () => {
    expect(modalSource).toContain('Data / Semana');
    expect(modalSource).toContain('Caixa / Orçamento');
    expect(modalSource).toContain('Divisão / Posição');
    expect(modalSource).toContain('Próximo Jogo');
  });

  it('shows real career-context badges', () => {
    expect(modalSource).toContain("'Dia de Jogo'");
    expect(modalSource).toContain("'Janela Aberta'");
    expect(modalSource).toContain("'Fim de Temporada'");
  });

  it('exposes accessible compact save controls', () => {
    expect(modalSource).toContain('aria-label="Renomear carreira"');
    expect(modalSource).toContain('aria-label="Duplicar carreira"');
    expect(modalSource).toContain('aria-label="Excluir carreira"');
  });

  it('finishes with product version, save count, and the editor route', () => {
    expect(modalSource).toContain('Tactical Arena v0.1.0');
    expect(modalSource).toContain('Saves: {saves.length} / Ilimitado');
    expect(modalSource).toContain('Mod Packs & Editor');
    expect(modalSource).toContain("navigate('/team-editor')");
  });

  it('wires complete tab semantics between the rail and active panel', () => {
    expect(modalSource).toContain('id={`career-hub-tab-${t.id}`}');
    expect(modalSource).toContain('aria-controls={`career-hub-panel-${t.id}`}');
    expect(modalSource).toContain('id={`career-hub-panel-${tab}`}');
    expect(modalSource).toContain('aria-labelledby={`career-hub-tab-${tab}`}');
  });

  it('uses accessible names for every compact confirmation control', () => {
    expect(modalSource).toContain('aria-live="polite"');
    expect(modalSource).toContain('aria-label="Salvar novo nome da carreira"');
    expect(modalSource).toContain('aria-label="Cancelar renomeação"');
    expect(modalSource).toContain('aria-label="Confirmar exclusão da carreira"');
    expect(modalSource).toContain('aria-label="Cancelar exclusão da carreira"');
  });

  it('keeps non-primary career actions out of gold styling', () => {
    const styles = readFileSync(join(__dirname, '../styles.css'), 'utf-8');
    const careerStyles = styles.slice(styles.indexOf('.career-hub-backdrop'), styles.indexOf('.btn-small'));
    for (const selector of [
      '.career-hub-back:hover',
      '.career-hub-close:hover',
      '.career-hub-empty',
      '.career-slot-play',
      '.career-manager-preview',
      '.career-choice:hover',
      '.career-choice strong',
    ]) {
      const start = careerStyles.indexOf(selector);
      const rule = careerStyles.slice(start, careerStyles.indexOf('}', start) + 1);
      expect(start, `${selector} must exist`).toBeGreaterThanOrEqual(0);
      expect(rule, `${selector} must stay neutral`).not.toMatch(/var\(--accent\)|#ffd700|#d4af37|212, 175, 55/);
    }
  });
});
