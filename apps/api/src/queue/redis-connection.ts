import { Redis, type RedisOptions } from 'ioredis';

/**
 * Tạo kết nối Redis cho BullMQ từ REDIS_URL (redis:// hoặc rediss:// cho TLS).
 * BullMQ 6 không tự kèm ioredis và trong môi trường ESM cần truyền kết nối đã tạo sẵn;
 * worker tự nhân bản kết nối này cho các lệnh chờ (blocking).
 */
export function createRedisConnection(
  url: string,
  extra: RedisOptions = {},
): Redis {
  return new Redis(url, {
    // BullMQ yêu cầu cho worker: không giới hạn số lần thử lại mỗi lệnh
    maxRetriesPerRequest: null,
    ...extra,
  });
}
