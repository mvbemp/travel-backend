import { Injectable } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { NotificationGateway } from './notification.gateway';

export type NotificationType = 'MESSAGE_NEW';

export interface CreateNotificationInput {
  userId: number;
  type: NotificationType;
  title: string;
  body?: string | null;
  data?: Prisma.InputJsonValue | null;
}

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: NotificationGateway,
  ) {}

  async create(input: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: {
        user_id: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        data: input.data ?? Prisma.JsonNull,
      },
    });
    this.gateway.broadcastNew(input.userId, notification);
    return notification;
  }

  async list(userId: number, opts: { limit?: number; cursor?: number } = {}) {
    const take = Math.min(Math.max(opts.limit ?? 20, 1), 100);
    const where: Prisma.NotificationWhereInput = { user_id: userId };
    if (opts.cursor) where.id = { lt: opts.cursor };
    return this.prisma.notification.findMany({
      where,
      orderBy: { id: 'desc' },
      take,
    });
  }

  async unreadCount(userId: number): Promise<number> {
    return this.prisma.notification.count({
      where: { user_id: userId, read_at: null },
    });
  }

  async markAsRead(userId: number, id: number) {
    const now = new Date();
    const result = await this.prisma.notification.updateMany({
      where: { id, user_id: userId, read_at: null },
      data: { read_at: now },
    });
    if (result.count > 0) {
      this.gateway.broadcastRead(userId, id, now);
    }
    return { updated: result.count, read_at: now };
  }

  async markAllAsRead(userId: number) {
    const now = new Date();
    const result = await this.prisma.notification.updateMany({
      where: { user_id: userId, read_at: null },
      data: { read_at: now },
    });
    if (result.count > 0) {
      this.gateway.broadcastAllRead(userId, now);
    }
    return { updated: result.count, read_at: now };
  }
}
