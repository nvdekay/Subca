import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { ConnectionsService } from './connections.service.js';
import { EMAIL_SYNC_QUEUE, type EmailSyncJob } from './email-sync.constants.js';

@Processor(EMAIL_SYNC_QUEUE, { concurrency: 2 })
export class EmailSyncProcessor extends WorkerHost {
  constructor(private readonly connections: ConnectionsService) {
    super();
  }

  process(job: Job<EmailSyncJob>) {
    return this.connections.processSyncRun(job.data);
  }
}
