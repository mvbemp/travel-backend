import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

type AuthedSocket = Socket & { data: { userId: number; email: string } };

function userRoom(userId: number): string {
  return `user:${userId}`;
}

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: (process.env.CORS_ORIGINS?.split(',') ?? []).filter(Boolean),
    credentials: true,
  },
})
export class NotificationGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationGateway.name);

  constructor(private readonly jwtService: JwtService) {}

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
    await client.join(userRoom(userId));
  }

  handleDisconnect(_client: AuthedSocket) {
    // socket.io cleans up rooms automatically
  }

  broadcastNew(userId: number, notification: unknown) {
    this.server.to(userRoom(userId)).emit('notification:new', { notification });
  }

  broadcastRead(userId: number, id: number, readAt: Date) {
    this.server.to(userRoom(userId)).emit('notification:read', {
      id,
      read_at: readAt,
    });
  }

  broadcastAllRead(userId: number, readAt: Date) {
    this.server.to(userRoom(userId)).emit('notification:all-read', {
      read_at: readAt,
    });
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
