import 'dotenv/config';
import mongoose from 'mongoose';
import { connectToDatabase } from '../utils/db.js';
import { UserModel } from '../models/User.js';

async function run() {
  await connectToDatabase();

  const result = await UserModel.updateMany(
    {},
    [
      {
        $set: {
          failedLoginCount: { $ifNull: ['$failedLoginCount', 0] },
          lastFailedLogin: { $ifNull: ['$lastFailedLogin', null] },
          lockedUntil: { $ifNull: ['$lockedUntil', null] },
        },
      },
    ],
  );

  console.log('Backfill complete:', {
    matched: result.matchedCount,
    modified: result.modifiedCount,
  });
}

run()
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.connection.close();
  });
