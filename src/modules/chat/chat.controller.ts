import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { chatFileUploadOptions } from './chat-upload.config';
import { SendMessageDto } from './dto/send-message.dto';

@ApiTags('Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly chatGateway: ChatGateway,
  ) {}

  @Get('groups')
  listGroupChats(@CurrentUser() user: { id: number }) {
    return this.chatService.listGroupChats(user.id);
  }

  @Get('groups/unread-total')
  unreadTotal(@CurrentUser() user: { id: number }) {
    return this.chatService.getTotalUnread(user.id).then((total) => ({ total }));
  }

  @Get('groups/:id/messages')
  listMessages(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Query('before') before?: string,
    @Query('take') take?: string,
  ) {
    const beforeId = before ? Number(before) : undefined;
    const takeN = take ? Number(take) : 50;
    return this.chatService.listMessages(user.id, id, beforeId, takeN);
  }

  @Post('groups/:id/messages')
  async sendMessage(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SendMessageDto,
  ) {
    const message = await this.chatService.createTextMessage(
      user.id,
      id,
      dto.content ?? '',
    );
    await this.chatGateway.broadcastNewMessage(id, message);
    return message;
  }

  @Post('groups/:id/attachments')
  @UseInterceptors(FileInterceptor('file', chatFileUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        content: { type: 'string' },
      },
      required: ['file'],
    },
  })
  async uploadAttachment(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body('content') content?: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('File is required');
    const message = await this.chatService.createFileMessage(
      user.id,
      id,
      file,
      content,
    );
    await this.chatGateway.broadcastNewMessage(id, message);
    return message;
  }

  @Post('groups/:id/read')
  @HttpCode(HttpStatus.OK)
  markRead(
    @CurrentUser() user: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.chatService.markGroupChatRead(user.id, id);
  }
}
