import { sendDM } from './dm';
import {
  generateT7ReminderMessage,
  generateT4CoreReminderMessage,
  generateT4OptionalReminderMessage,
  generateT2FinalCallDM,
  NotificationContext,
} from './messages';

export async function sendT7Reminder(
  userId: string,
  username: string,
  context: NotificationContext,
  force?: boolean,
) {
  const content = generateT7ReminderMessage(context);
  return sendDM(userId, username, content, 'T-7 Reminder', force);
}

export async function sendT4CoreReminder(
  userId: string,
  username: string,
  context: NotificationContext,
  force?: boolean,
) {
  const content = generateT4CoreReminderMessage(context);
  return sendDM(userId, username, content, 'T-4 Core Reminder', force);
}

export async function sendT4OptionalReminder(
  userId: string,
  username: string,
  context: NotificationContext,
  force?: boolean,
) {
  const content = generateT4OptionalReminderMessage(context);
  return sendDM(userId, username, content, 'T-4 Optional Reminder', force);
}

export async function sendT2FinalCall(
  userId: string,
  username: string,
  context: NotificationContext,
  force?: boolean,
) {
  const content = generateT2FinalCallDM(context);
  return sendDM(userId, username, content, 'T-2 Final Call', force);
}
