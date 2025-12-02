import { Schema, model, InferSchemaType } from 'mongoose';

const ScreenshotSchema = new Schema(
  {
    filename: { type: String },
    url: { type: String },
    mtime: { type: Date },
    domain: { type: String },
    username: { type: String },
  },
  { versionKey: false },
);

ScreenshotSchema.index({ mtime: -1 });
ScreenshotSchema.index({ username: 1, mtime: -1 });
ScreenshotSchema.index({ domain: 1, mtime: -1 });

export type Screenshot = InferSchemaType<typeof ScreenshotSchema>;
export const ScreenshotModel = model('Screenshot', ScreenshotSchema);


