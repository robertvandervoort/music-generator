export const SCALES: Record<string, number[]> = {
  Major: [0, 2, 4, 5, 7, 9, 11],
  Minor: [0, 2, 3, 5, 7, 8, 10],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Phrygian: [0, 1, 3, 5, 7, 8, 10],
  Lydian: [0, 2, 4, 6, 7, 9, 11],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],
  Locrian: [0, 1, 3, 5, 6, 8, 10],
  'Major Pentatonic': [0, 2, 4, 7, 9],
  'Minor Pentatonic': [0, 3, 5, 7, 10],
  'Harmonic Minor': [0, 2, 3, 5, 7, 8, 11],
  'Melodic Minor': [0, 2, 3, 5, 7, 9, 11],
  'Blues': [0, 3, 5, 6, 7, 10],
  'Whole Tone': [0, 2, 4, 6, 8, 10],
  'Chromatic': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
};

export class Quantizer {
  scale: number[];
  scaleName: string;
  rootNote: number; // MIDI note number, e.g. 60 for C4

  constructor(scaleName: string = 'Minor Pentatonic', rootNote: number = 60) {
    this.scaleName = SCALES[scaleName] ? scaleName : 'Minor Pentatonic';
    this.scale = SCALES[scaleName] || SCALES['Minor Pentatonic'];
    this.rootNote = rootNote;
  }

  setScale(scaleName: string) {
    if (SCALES[scaleName]) {
      this.scaleName = scaleName;
      this.scale = SCALES[scaleName];
    }
  }

  setRoot(rootNote: number) {
    this.rootNote = rootNote;
  }

  getScaleFrequency(degree: number, octaveOffset: number = 0): number {
    const wrappedDegree = ((degree % this.scale.length) + this.scale.length) % this.scale.length;
    const scaleOctave = Math.floor(degree / this.scale.length);
    const midiNote = this.rootNote + ((octaveOffset + scaleOctave) * 12) + this.scale[wrappedDegree];
    return 440 * Math.pow(2, (midiNote - 69) / 12);
  }

  // Maps a value (0 to 1) to a quantized frequency
  quantize(normalizedValue: number, octaves: number = 3): number {
    const totalNotesInScale = this.scale.length;
    const totalNotes = totalNotesInScale * octaves;
    
    // Find the closest note index based on the normalized value
    // Handle the edge case where normalizedValue is exactly 1.0
    const val = Math.min(normalizedValue, 0.9999); 
    const noteIndex = Math.floor(val * totalNotes);
    
    const octaveOffset = Math.floor(noteIndex / totalNotesInScale);
    const scaleIndex = noteIndex % totalNotesInScale;
    
    const midiNote = this.rootNote + (octaveOffset * 12) + this.scale[scaleIndex];
    
    // Convert MIDI to frequency
    return 440 * Math.pow(2, (midiNote - 69) / 12);
  }
}
