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
    // Normalized fields for indexed search.
    usernameLower: { type: String },
    domainLower: { type: String },
    typeLower: { type: String },
    reasonLower: { type: String },
    dataReasonLower: { type: String },
  },
  { versionKey: false },
);

EventSchema.index({ timestamp: -1 });
EventSchema.index({ username: 1, timestamp: -1 });
EventSchema.index({ domain: 1, timestamp: -1 });
EventSchema.index({ type: 1, timestamp: -1 });
EventSchema.index({ username: 1, domain: 1, timestamp: -1 });
EventSchema.index({ username: 1, type: 1, timestamp: -1 });
EventSchema.index(
  { username: 'text', domain: 'text', type: 'text', reason: 'text', dataReasonLower: 'text' },
  { default_language: 'none' },
);

export type Event = InferSchemaType<typeof EventSchema>;
export const EventModel = model('Event', EventSchema);

