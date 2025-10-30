import { Schema, model, InferSchemaType } from 'mongoose';

const EventSchema = new Schema(
  {
    deviceIdHash: { type: String },
    domain: { type: String },
    durationMs: { type: Number },
    timestamp: { type: Date },
    reason: { type: String },
    username: { type: String },
    type: { type: String },
    data: { type: Schema.Types.Mixed },
  },
  { versionKey: false },
);

EventSchema.index({ timestamp: -1 });
EventSchema.index({ username: 1, timestamp: -1 });
EventSchema.index({ domain: 1, timestamp: -1 });

export type Event = InferSchemaType<typeof EventSchema>;
export const EventModel = model('Event', EventSchema);


