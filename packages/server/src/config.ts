import path from 'node:path';

const env = process.env;

export const config = {
  port: Number(env.PORT ?? 3300),
  publicDir: path.resolve(env.PUBLIC_DIR ?? path.join(process.cwd(), '../client/dist')),
  dataDir: path.resolve(env.DATA_DIR ?? path.join(process.cwd(), 'data')),
  roomTtlMs: Number(env.ROOM_TTL_MINUTES ?? 120) * 60_000,
  accessPassword: env.ACCESS_PASSWORD ?? '',
  trustProxy: env.TRUST_PROXY === '1' || env.TRUST_PROXY === 'true',
};
