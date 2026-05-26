import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { promises as fsp } from 'fs';
import { __ } from 'src/common/helpers/translation.helper';
import { PrismaService } from 'src/core/prisma/prisma.service';
import {
  chatFileAbsolutePath,
  chatFileRelativePath,
} from './chat-upload.config';

const USER_SHORT_SELECT = {
  id: true,
  email: true,
  full_name: true,
  type: true,
} as const;

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async listGroupChats(currentUserId: number) {
    const groups = await this.prisma.group.findMany({
      orderBy: { updated_at: 'desc' },
      include: {
        messages: {
          orderBy: { created_at: 'desc' },
          take: 1,
          include: { sender: { select: USER_SHORT_SELECT } },
        },
        chatReads: {
          where: { user_id: currentUserId },
          select: { last_read_at: true },
        },
      },
    });

    return Promise.all(
      groups.map(async (g) => {
        const lastMessage = g.messages[0] ?? null;
        const lastReadAt = g.chatReads[0]?.last_read_at ?? null;
        const unread = await this.countUnread(g.id, currentUserId, lastReadAt);
        return this.shapeGroupChat(g, lastMessage, unread);
      }),
    );
  }

  async getTotalUnread(currentUserId: number): Promise<number> {
    const reads = await this.prisma.groupChatRead.findMany({
      where: { user_id: currentUserId },
      select: { group_id: true, last_read_at: true },
    });
    const readMap = new Map<number, Date>(
      reads.map((r) => [r.group_id, r.last_read_at]),
    );

    const groups = await this.prisma.group.findMany({ select: { id: true } });

    let total = 0;
    for (const g of groups) {
      total += await this.countUnread(
        g.id,
        currentUserId,
        readMap.get(g.id) ?? null,
      );
    }
    return total;
  }

  async listMessages(
    currentUserId: number,
    groupId: number,
    before?: number,
    take = 50,
  ) {
    await this.assertGroupExists(groupId);
    const where: { group_id: number; id?: { lt: number } } = {
      group_id: groupId,
    };
    if (before) where.id = { lt: before };
    const items = await this.prisma.groupMessage.findMany({
      where,
      orderBy: { id: 'desc' },
      take: Math.min(Math.max(take, 1), 200),
      include: { sender: { select: USER_SHORT_SELECT } },
    });
    return items.reverse();
  }

  async createTextMessage(
    senderId: number,
    groupId: number,
    content: string,
  ) {
    const trimmed = content?.trim();
    if (!trimmed) {
      throw new BadRequestException(__('messages.chat_message_empty'));
    }
    await this.assertGroupExists(groupId);
    const message = await this.prisma.groupMessage.create({
      data: { group_id: groupId, sender_id: senderId, content: trimmed },
      include: { sender: { select: USER_SHORT_SELECT } },
    });
    await this.prisma.group.update({
      where: { id: groupId },
      data: { updated_at: new Date() },
    });
    return message;
  }

  async createFileMessage(
    senderId: number,
    groupId: number,
    file: Express.Multer.File,
    content?: string,
  ) {
    try {
      await this.assertGroupExists(groupId);
    } catch (err) {
      await this.removeFileFromDisk(chatFileRelativePath(file.filename));
      throw err;
    }
    const trimmed = content?.trim();
    const message = await this.prisma.groupMessage.create({
      data: {
        group_id: groupId,
        sender_id: senderId,
        content: trimmed && trimmed.length > 0 ? trimmed : null,
        file_path: chatFileRelativePath(file.filename),
      },
      include: { sender: { select: USER_SHORT_SELECT } },
    });
    await this.prisma.group.update({
      where: { id: groupId },
      data: { updated_at: new Date() },
    });
    return message;
  }

  async markGroupChatRead(currentUserId: number, groupId: number) {
    await this.assertGroupExists(groupId);
    const now = new Date();
    await this.prisma.groupChatRead.upsert({
      where: {
        group_id_user_id: { group_id: groupId, user_id: currentUserId },
      },
      create: {
        group_id: groupId,
        user_id: currentUserId,
        last_read_at: now,
      },
      update: { last_read_at: now },
    });
    return { read_at: now };
  }

  async getAllUserIds(): Promise<number[]> {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    return users.map((u) => u.id);
  }

  async assertGroupExists(groupId: number): Promise<void> {
    const g = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true },
    });
    if (!g) throw new NotFoundException(__('messages.group_not_found'));
  }

  private async countUnread(
    groupId: number,
    userId: number,
    lastReadAt: Date | null,
  ): Promise<number> {
    return this.prisma.groupMessage.count({
      where: {
        group_id: groupId,
        sender_id: { not: userId },
        ...(lastReadAt ? { created_at: { gt: lastReadAt } } : {}),
      },
    });
  }

  private async removeFileFromDisk(relativePath: string): Promise<void> {
    try {
      await fsp.unlink(chatFileAbsolutePath(relativePath));
    } catch {
      // best-effort cleanup
    }
  }

  private shapeGroupChat(
    g: {
      id: number;
      name: string;
      description: string | null;
      date: Date;
      is_finished: boolean;
      created_at: Date;
      updated_at: Date;
    },
    lastMessage: unknown,
    unread: number,
  ) {
    return {
      id: g.id,
      name: g.name,
      description: g.description,
      date: g.date,
      is_finished: g.is_finished,
      created_at: g.created_at,
      updated_at: g.updated_at,
      last_message: lastMessage,
      unread_count: unread,
    };
  }
}
