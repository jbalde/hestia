import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as webpush from "web-push";
import { PushSubscriptionEntity } from "./push-subscription.entity";
import { SettingsService } from "../settings/settings.service";

const VAPID_PUBLIC_KEY  = "vapid_public_key";
const VAPID_PRIVATE_KEY = "vapid_private_key";
const VAPID_EMAIL       = "vapid_email";

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

@Injectable()
export class NotificationsService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(PushSubscriptionEntity)
    private readonly subRepo: Repository<PushSubscriptionEntity>,
    private readonly settingsService: SettingsService,
  ) {}

  async onModuleInit() {
    await this.ensureVapidKeys();
  }

  // ── VAPID ────────────────────────────────────────────────────────

  private async ensureVapidKeys() {
    let pub  = await this.settingsService.get(VAPID_PUBLIC_KEY);
    let priv = await this.settingsService.get(VAPID_PRIVATE_KEY);

    if (!pub || !priv) {
      const keys = webpush.generateVAPIDKeys();
      pub  = keys.publicKey;
      priv = keys.privateKey;
      await this.settingsService.set(VAPID_PUBLIC_KEY,  pub);
      await this.settingsService.set(VAPID_PRIVATE_KEY, priv);
      await this.settingsService.set(VAPID_EMAIL, "mailto:hestia@familia.local");
      this.logger.log("Generated new VAPID keys");
    }

    webpush.setVapidDetails(
      (await this.settingsService.get(VAPID_EMAIL)) ?? "mailto:hestia@familia.local",
      pub,
      priv,
    );
  }

  async getVapidPublicKey(): Promise<string> {
    return (await this.settingsService.get(VAPID_PUBLIC_KEY)) ?? "";
  }

  // ── Subscriptions ────────────────────────────────────────────────

  async subscribe(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    const existing = await this.subRepo.findOne({ where: { endpoint: sub.endpoint } });
    if (existing) {
      existing.userId  = userId;
      existing.p256dh  = sub.keys.p256dh;
      existing.auth    = sub.keys.auth;
      await this.subRepo.save(existing);
    } else {
      await this.subRepo.save(
        this.subRepo.create({ userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth })
      );
    }
    return { message: "Suscripción registrada" };
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.subRepo.delete({ userId, endpoint });
    return { message: "Suscripción cancelada" };
  }

  // ── Sending ──────────────────────────────────────────────────────

  async sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
    const subs = await this.subRepo.find({ where: { userId } });
    let sent = 0;

    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify({ title: payload.title, body: payload.body, url: payload.url ?? "/dashboard", icon: "/logo.png" }),
        );
        sent++;
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          // Subscription expired — remove it
          await this.subRepo.delete({ id: sub.id });
        } else {
          this.logger.warn(`Push failed for user ${userId}: ${err.message}`);
        }
      }
    }
    return sent;
  }

  async sendPushToAll(payload: PushPayload): Promise<number> {
    const subs = await this.subRepo.find();
    const userIds = [...new Set(subs.map((s) => s.userId))];
    let total = 0;
    for (const userId of userIds) {
      total += await this.sendPushToUser(userId, payload);
    }
    return total;
  }
}
