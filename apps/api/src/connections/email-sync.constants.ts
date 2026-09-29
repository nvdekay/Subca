export const EMAIL_SYNC_QUEUE = 'email-sync';

export interface EmailSyncJob {
  userId: string;
  accountId: string;
  runId: string;
}
