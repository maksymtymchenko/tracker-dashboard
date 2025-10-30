import 'dotenv/config';
import mongoose from 'mongoose';

/**
 * Connect to MongoDB using Mongoose
 */
export async function connectToDatabase() {
  const mongoUri =
    process.env.MONGO_URI || 'mongodb://localhost:27017/tracker_dashboard';
  const dbName = process.env.MONGO_DB || 'activity_collector';
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  await mongoose.connect(mongoUri, { dbName });
  return mongoose.connection;
}
