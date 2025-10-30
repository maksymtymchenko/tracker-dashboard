import { Schema, model, InferSchemaType } from 'mongoose';

const UserSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['ADMIN', 'VIEWER'], default: 'VIEWER', index: true },
    createdAt: { type: Date, default: Date.now },
    lastLogin: { type: Date },
  },
  { versionKey: false },
);

export type User = InferSchemaType<typeof UserSchema>;
export const UserModel = model('User', UserSchema);


