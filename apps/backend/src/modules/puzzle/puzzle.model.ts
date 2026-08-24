import mongoose, { Schema, Document } from 'mongoose';

export interface IPuzzleSolution {
  from: string;
  to: string;
  promotion?: string;
}

export interface IPuzzle extends Document {
  puzzleId: string;
  title: string;
  description: string;
  difficulty: 'Dễ' | 'Trung bình' | 'Khó';
  rating: number;
  fen: string;
  turn: 'w' | 'b';
  solution: IPuzzleSolution[];
  hint: string;
}

const PuzzleSchema: Schema = new Schema(
  {
    puzzleId: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    difficulty: { type: String, enum: ['Dễ', 'Trung bình', 'Khó'], default: 'Dễ' },
    rating: { type: Number, required: true, default: 1000 },
    fen: { type: String, required: true },
    turn: { type: String, enum: ['w', 'b'], required: true },
    solution: [
      {
        from: { type: String, required: true },
        to: { type: String, required: true },
        promotion: { type: String },
      },
    ],
    hint: { type: String, required: true },
  },
  { timestamps: true }
);

export const PuzzleModel = mongoose.model<IPuzzle>('Puzzle', PuzzleSchema);
