import mongoose from 'mongoose';

const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 2000; // 2s, 4s, 8s, 16s, 32s

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not set in .env — cannot start server.');
  }

  // Atlas connections occasionally fail their TLS handshake on flaky networks
  // (transient, not a code issue) — retry with backoff instead of exiting.
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      await mongoose.connect(uri);
      console.log('[db] MongoDB connected successfully.');

      mongoose.connection.on('error', (err) => {
        console.error('[db] MongoDB connection error:', err);
      });

      mongoose.connection.on('disconnected', () => {
        console.warn('[db] MongoDB disconnected. Mongoose will attempt to reconnect automatically.');
      });

      return;
    } catch (err) {
      const isLastAttempt = attempt === MAX_ATTEMPTS;
      console.error(`[db] Connection attempt ${attempt}/${MAX_ATTEMPTS} failed:`, (err as Error).message);
      if (isLastAttempt) throw err;

      const delay = BASE_DELAY_MS * 2 ** (attempt - 1);
      console.log(`[db] Retrying in ${delay / 1000}s…`);
      await sleep(delay);
    }
  }
}
