import { createHash } from 'node:crypto';

export type HumanizationPhraseBank = {
  openers?: string[];
  bodies?: string[];
  closings?: string[];
};

export type HumanizationConfig = {
  profileId: string;
  rotationStrategy: 'round_robin' | 'random';
  baseTemplateText: string;
  phraseBank: HumanizationPhraseBank;
  syntacticVariationLevel: number;
  minDelayMs: number;
  maxDelayMs: number;
  lastVariantIndex: number;
  lastVariantHash: string | null;
};

export type HumanizationVariables = {
  nome: string;
  cidade: string;
};

export type HumanizationResult = {
  text: string;
  hash: string;
  delayMs: number;
  nextIndex: number;
};

export class MessageVariationEngine {
  generate(config: HumanizationConfig, vars: HumanizationVariables): HumanizationResult {
    const openers = config.phraseBank.openers?.length ? config.phraseBank.openers : ['Oi {{nome}}'];
    const bodies = config.phraseBank.bodies?.length ? config.phraseBank.bodies : [config.baseTemplateText];
    const closings = config.phraseBank.closings?.length
      ? config.phraseBank.closings
      : ['Se quiser, te explico rapidinho.'];

    const nextIndex =
      config.rotationStrategy === 'round_robin'
        ? config.lastVariantIndex + 1
        : Math.floor(Math.random() * 10_000);

    const opener = openers[Math.abs(nextIndex) % openers.length];
    const body = bodies[Math.abs(nextIndex + 1) % bodies.length];
    const closing = closings[Math.abs(nextIndex + 2) % closings.length];

    let text = [opener, body, closing].join(' ').replace(/\s+/g, ' ').trim();
    text = this.renderVariables(text, vars);
    text = this.applySyntacticVariation(text, config.syntacticVariationLevel, nextIndex);

    let hash = this.hashText(text);
    if (config.lastVariantHash && hash === config.lastVariantHash) {
      text = text.endsWith('.') ? `${text.slice(0, -1)}!` : `${text}.`;
      hash = this.hashText(text);
    }

    return {
      text,
      hash,
      delayMs: this.randomDelay(config.minDelayMs, config.maxDelayMs),
      nextIndex
    };
  }

  private renderVariables(text: string, vars: HumanizationVariables): string {
    return text
      .replace(/\{\{\s*nome\s*\}\}/gi, vars.nome)
      .replace(/\{\{\s*cidade\s*\}\}/gi, vars.cidade);
  }

  private applySyntacticVariation(text: string, level: number, seed: number): string {
    if (level <= 0) {
      return text;
    }

    const alternatives = [
      [' tudo bem', ' tudo certo'],
      [' posso', ' consigo'],
      [' te mostrar', ' te explicar']
    ] as const;

    let output = text;
    const safeLevel = Math.min(level, alternatives.length);
    for (let i = 0; i < safeLevel; i++) {
      const [from, to] = alternatives[(seed + i) % alternatives.length];
      output = output.replace(new RegExp(from, 'i'), to);
    }

    return output;
  }

  private randomDelay(minDelayMs: number, maxDelayMs: number): number {
    const min = Math.max(0, minDelayMs);
    const max = Math.max(min, maxDelayMs);
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  private hashText(text: string): string {
    return createHash('sha256').update(text).digest('hex').slice(0, 24);
  }
}
