import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';

// Tiền lưu BigInt; JSON không hỗ trợ BigInt nên trả về dạng chuỗi để không mất độ chính xác.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (
  this: bigint,
) {
  return this.toString();
};

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: process.env['NODE_ENV'] !== 'test' }),
  );
  app.enableShutdownHooks();
  await app.listen(Number(process.env['PORT'] ?? 3000), '0.0.0.0');
}

await bootstrap();
