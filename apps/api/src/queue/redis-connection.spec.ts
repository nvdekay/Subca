import { createRedisConnection } from './redis-connection.js';

describe('createRedisConnection', () => {
  it('đọc host, cổng, mật khẩu, db và TLS từ URL; bật maxRetriesPerRequest = null cho BullMQ', async () => {
    const client = createRedisConnection(
      'rediss://default:p%40ss@redis.example.com:6380/2',
      { lazyConnect: true },
    );
    expect(client.options).toMatchObject({
      host: 'redis.example.com',
      port: 6380,
      username: 'default',
      password: 'p@ss',
      db: 2,
      maxRetriesPerRequest: null,
    });
    expect(client.options.tls).toBeDefined();
    client.disconnect();
  });

  it('redis:// không mật khẩu, không TLS', () => {
    const client = createRedisConnection('redis://localhost:6379', {
      lazyConnect: true,
    });
    expect(client.options).toMatchObject({
      host: 'localhost',
      port: 6379,
      db: 0,
    });
    expect(client.options.tls).toBeUndefined();
    client.disconnect();
  });
});
