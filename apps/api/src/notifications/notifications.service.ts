import { Injectable } from "@nestjs/common";

export interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

// In-memory push subscriptions (in production use a database)
const subscriptions = new Map<string, PushSubscription[]>();

@Injectable()
export class NotificationsService {
  subscribe(userId: string, subscription: PushSubscription) {
    const existing = subscriptions.get(userId) || [];
    const idx = existing.findIndex((s) => s.endpoint === subscription.endpoint);
    if (idx >= 0) {
      existing[idx] = subscription;
    } else {
      existing.push(subscription);
    }
    subscriptions.set(userId, existing);
    return { message: "Suscripción registrada" };
  }

  unsubscribe(userId: string, endpoint: string) {
    const existing = subscriptions.get(userId) || [];
    subscriptions.set(
      userId,
      existing.filter((s) => s.endpoint !== endpoint)
    );
    return { message: "Suscripción cancelada" };
  }

  getSubscriptions(userId: string): PushSubscription[] {
    return subscriptions.get(userId) || [];
  }
}
