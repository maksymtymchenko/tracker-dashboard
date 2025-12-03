import { Schema, model, InferSchemaType } from 'mongoose';

const UserProfileSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, index: true },
    /**
     * Human-friendly display name for the employee.
     * This is used purely for UI/analytics; authentication still
     * relies on the main User document (if it exists).
     */
    displayName: { type: String, required: true },
  },
  { timestamps: true, versionKey: false },
);

export type UserProfile = InferSchemaType<typeof UserProfileSchema>;
export const UserProfileModel = model('UserProfile', UserProfileSchema);



