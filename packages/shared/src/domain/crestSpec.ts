/**
 * What a club crest has to be, and how to ask for one.
 *
 * A manager founding a club can bring their own badge, and "bring your own image" is only a real offer if
 * the game says what it needs before the upload fails. So the rules live here as data rather than as a
 * sentence in a form: the same numbers validate the file on the server, describe the requirements on the
 * screen, and go into the prompt handed to whoever or whatever draws the thing.
 */
export const CREST_SPEC = {
  format: 'PNG',
  /** Below this it turns to mush on the club page, which renders it at 96px on a high-density screen. */
  minSize: 128,
  /** Above this is wasted bytes: nothing in the game draws a crest larger than this. */
  maxSize: 1024,
  /** How far from square a badge may be before it distorts in the slots that show it. */
  aspectTolerance: 0.15,
  maxBytes: 2 * 1024 * 1024,
  /** The badge sits on the club's own colour in several places, so it cannot bring its own background. */
  transparentBackground: true,
  /** Nothing important may sit outside this share of the canvas: round slots crop the corners. */
  safeAreaShare: 0.88,
} as const;

/** The requirements in the manager's own language, for the creator screen to list. */
export const CREST_RULES: string[] = [
  `Arquivo ${CREST_SPEC.format}, fundo transparente.`,
  `Quadrado, entre ${CREST_SPEC.minSize} e ${CREST_SPEC.maxSize} pixels de lado.`,
  'O escudo aparece em círculo em várias telas, então deixe uma margem de folga nas bordas.',
  `Até ${CREST_SPEC.maxBytes / (1024 * 1024)} MB.`,
  'Sem texto pequeno: em muitos lugares o escudo é desenhado com 20 pixels.',
];

export interface CrestPromptInput {
  clubName: string;
  /** Where the club is from, in words. Empty is fine. */
  city?: string;
  countryName: string;
  /** The club's colours, as the manager described them. Empty is fine. */
  colors?: string;
}

/**
 * The prompt a manager can paste into an image generator to get a badge this game will accept.
 *
 * Written as a single paragraph on purpose: image generators read one, and a bulleted specification tends
 * to come back as a picture of a bulleted specification. The constraints that actually matter to the game
 * (square, transparent, no small text) are stated as part of the description rather than as a checklist.
 */
export function buildCrestPrompt(input: CrestPromptInput): string {
  const place = [input.city, input.countryName].filter(Boolean).join(', ');
  const colors = input.colors?.trim()
    ? `nas cores ${input.colors.trim()}`
    : 'numa combinação de duas cores fortes que funcione contra fundo escuro';

  return (
    `Escudo de futebol do clube "${input.clubName}", de ${place}, ${colors}. ` +
    'Emblema vetorial, simétrico, com formas grandes e limpas, sem texto pequeno e sem letras miúdas. ' +
    `Enquadrado como um quadrado de ${CREST_SPEC.maxSize} por ${CREST_SPEC.maxSize} pixels, ` +
    'com o escudo centralizado e uma margem de folga nas bordas, porque ele será exibido dentro de um círculo. ' +
    'Fundo totalmente transparente, sem sombra e sem moldura. ' +
    'Precisa continuar legível reduzido a 20 pixels.'
  );
}

export interface CrestValidation {
  ok: boolean;
  problem?: string;
}

/**
 * Checks a badge against the spec, from the dimensions alone.
 *
 * Kept pure and shared so the creator screen can say what is wrong with a file before uploading it, and the
 * server can refuse the same file for the same stated reason. A rule enforced in only one of those two
 * places is either a surprise or a hole.
 */
export function validateCrestDimensions(width: number, height: number): CrestValidation {
  if (width < CREST_SPEC.minSize || height < CREST_SPEC.minSize) {
    return { ok: false, problem: `O escudo precisa ter pelo menos ${CREST_SPEC.minSize} pixels de lado.` };
  }
  if (width > CREST_SPEC.maxSize || height > CREST_SPEC.maxSize) {
    return { ok: false, problem: `O escudo passa de ${CREST_SPEC.maxSize} pixels de lado.` };
  }

  const ratio = width / height;
  if (Math.abs(ratio - 1) > CREST_SPEC.aspectTolerance) {
    return { ok: false, problem: 'O escudo precisa ser quadrado, ou muito perto disso.' };
  }

  return { ok: true };
}
