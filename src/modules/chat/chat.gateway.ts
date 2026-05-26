import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { NotificationService } from '../notification/notification.service';
import { ChatService } from './chat.service';

type AuthedSocket = Socket & { data: { userId: number; email: string } };

const CHAT_ALL_ROOM = 'chat:all';

function groupRoom(id: number): string {
  return `group:${id}`;
}

function userRoom(userId: number): string {
  return `user:${userId}`;
}

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: (process.env.CORS_ORIGINS?.split(',') ?? []).filter(Boolean),
    credentials: true,
  },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
    private readonly notificationService: NotificationService,
  ) {}

  afterInit(server: Server) {
    server.use((socket, next) => {
      try {
        const token = this.extractToken(socket as AuthedSocket);
        if (!token) return next(new Error('Unauthorized'));
        const payload = this.jwtService.verify<{ sub: number; email: string }>(
          token,
          { secret: process.env.JWT_SECRET },
        );
        (socket as AuthedSocket).data.userId = payload.sub;
        (socket as AuthedSocket).data.email = payload.email;
        return next();
      } catch {
        return next(new Error('Unauthorized'));
      }
    });
  }

  async handleConnection(client: AuthedSocket) {
    const userId = client.data.userId;
    if (!userId) {
      client.disconnect(true);
      return;
    }
    await client.join([userRoom(userId), CHAT_ALL_ROOM]);
  }

  handleDisconnect(_client: AuthedSocket) {
    // socket.io cleans up rooms automatically
  }

  @SubscribeMessage('group:join')
  async onJoin(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { group_id: number },
  ) {
    const groupId = Number(body?.group_id);
    if (!groupId) throw new WsException('group_id required');
    await this.chatService.assertGroupExists(groupId);
    await client.join(groupRoom(groupId));
    return { ok: true };
  }

  @SubscribeMessage('group:leave')
  async onLeave(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { group_id: number },
  ) {
    const groupId = Number(body?.group_id);
    if (!groupId) return { ok: false };
    await client.leave(groupRoom(groupId));
    return { ok: true };
  }

  @SubscribeMessage('message:send')
  async onSend(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { group_id: number; content: string },
  ) {
    const groupId = Number(body?.group_id);
    if (!groupId) throw new WsException('group_id required');
    const message = await this.chatService.createTextMessage(
      client.data.userId,
      groupId,
      String(body?.content ?? ''),
    );
    await this.broadcastNewMessage(groupId, message);
    return message;
  }

  @SubscribeMessage('message:read')
  async onRead(
    @ConnectedSocket() client: AuthedSocket,
    @MessageBody() body: { group_id: number },
  ) {
    const groupId = Number(body?.group_id);
    if (!groupId) throw new WsException('group_id required');
    const { read_at } = await this.chatService.markGroupChatRead(
      client.data.userId,
      groupId,
    );
    this.server.to(userRoom(client.data.userId)).emit('message:read', {
      group_id: groupId,
      reader_id: client.data.userId,
      read_at,
    });
    return { ok: true };
  }

  async broadcastNewMessage(groupId: number, message: any) {
    this.server.to(CHAT_ALL_ROOM).emit('message:new', {
      group_id: groupId,
      message,
    });
    await this.notifyAllUsers(groupId, message);
  }

  private async notifyAllUsers(groupId: number, message: any) {
    const senderId: number = message?.sender_id;
    if (!senderId) return;
    const userIds = await this.chatService.getAllUserIds();

    const senderName: string =
      message?.sender?.full_name || message?.sender?.email || 'New message';
    const text: string | null = message?.content
      ? String(message.content).slice(0, 140)
      : null;

    for (const recipientId of userIds) {
      if (recipientId === senderId) continue;
      await this.notificationService.create({
        userId: recipientId,
        type: 'MESSAGE_NEW',
        title: senderName,
        body: text,
        data: {
          group_id: groupId,
          message_id: message?.id,
          sender_id: senderId,
          has_file: Boolean(message?.file_path),
        },
      });
    }
  }

  private extractToken(socket: AuthedSocket): string | null {
    const fromAuth = (socket.handshake.auth as { token?: string })?.token;
    if (fromAuth) return fromAuth;
    const header = socket.handshake.headers.authorization;
    if (header && header.toLowerCase().startsWith('bearer ')) {
      return header.slice(7);
    }
    const queryToken = socket.handshake.query?.token;
    if (typeof queryToken === 'string') return queryToken;
    return null;
  }
}
