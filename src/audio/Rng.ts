export class Rng {
  readonly seed: string;
  private state: number;

  constructor(seed: string | number) {
    this.seed = String(seed);
    this.state = Rng.hash(this.seed);
  }

  static randomSeed(): string {
    if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
      const values = new Uint32Array(2);
      crypto.getRandomValues(values);
      return `${values[0].toString(36)}-${values[1].toString(36)}`;
    }
    return `${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffffff).toString(36)}`;
  }

  private static hash(value: string): number {
    let hash = 1779033703 ^ value.length;
    for (let index = 0; index < value.length; index += 1) {
      hash = Math.imul(hash ^ value.charCodeAt(index), 3432918353);
      hash = (hash << 13) | (hash >>> 19);
    }
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    return (hash ^ (hash >>> 16)) >>> 0;
  }

  random(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + this.random() * (max - min);
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  chance(probability: number): boolean {
    return this.random() < Math.max(0, Math.min(1, probability));
  }

  pick<T>(values: readonly T[]): T {
    return values[this.int(0, values.length - 1)];
  }
}
