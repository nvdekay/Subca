export const REMINDERS_QUEUE = 'reminders';
export const REMINDER_JOB = 'send-reminder';

export interface ReminderJobData {
  reminderId: string;
}

/** Lượt nhắc trễ quá khoảng này (VD server tắt lâu) thì bỏ, không gửi muộn gây nhầm lẫn. */
export const STALE_AFTER_MS = 6 * 60 * 60 * 1000;
