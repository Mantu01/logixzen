import { Notification, app } from "electron";

export function showBadgeNotification(title: string, body: string): void {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
  app.dock?.setBadge("1");
}

export function showStreakNotification(streak: number): void {
  if (streak < 3 || !Notification.isSupported()) {
    return;
  }
  new Notification({
    title: "Streak updated",
    body: `${streak}-day streak. Keep it going.`,
  }).show();
}
