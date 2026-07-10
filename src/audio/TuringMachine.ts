import { Rng } from './Rng';

export class TuringMachine {
  register: boolean[];
  length: number;
  probability: number; // 0 to 1

  private rng: Rng;

  constructor(length: number = 16, rng: Rng = new Rng(Rng.randomSeed())) {
    this.length = length;
    this.rng = rng;
    // Initialize with random bits
    this.register = Array.from({ length }, () => this.rng.chance(0.5));
    this.probability = 0.1; // Default to slow morphing
  }

  reset(rng: Rng) {
    this.rng = rng;
    this.register = Array.from({ length: this.length }, () => this.rng.chance(0.5));
  }

  setProbability(prob: number) {
    this.probability = Math.max(0, Math.min(1, prob));
  }

  step(): boolean {
    const outputBit = this.register[this.length - 1];
    
    // Shift right
    for (let i = this.length - 1; i > 0; i--) {
      this.register[i] = this.register[i - 1];
    }
    
    // Determine new first bit based on probability
    let newBit = outputBit; // By default, loop perfectly
    if (this.rng.chance(this.probability)) {
      newBit = !newBit; // Flip the bit
    }
    
    this.register[0] = newBit;
    
    return outputBit;
  }

  // Convert the register to a normalized value (0 to 1)
  getNormalizedValue(): number {
    let num = 0;
    const bitsToUse = Math.min(8, this.length);
    for (let i = 0; i < bitsToUse; i++) { 
      if (this.register[i]) {
        num |= (1 << i);
      }
    }
    return num / ((1 << bitsToUse) - 1);
  }

  getBits(): boolean[] {
    return [...this.register];
  }
}
