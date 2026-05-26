import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { diskStorage } from 'multer';
import { randomBytes } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { UPLOADS_DIR } from '../group/upload.config';

export const CHAT_DIR = join(UPLOADS_DIR, 'chat');
export const CHAT_FILE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

if (!existsSync(CHAT_DIR)) {
  mkdirSync(CHAT_DIR, { recursive: true });
}

export const chatFileStorage = diskStorage({
  destination: CHAT_DIR,
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    const safe = randomBytes(12).toString('hex');
    cb(null, `${Date.now()}-${safe}${ext}`);
  },
});

export const chatFileFilter = (
  _req: Request,
  _file: Express.Multer.File,
  cb: (err: Error | null, accept: boolean) => void,
) => cb(null, true);

export const chatFileUploadOptions = {
  storage: chatFileStorage,
  fileFilter: chatFileFilter,
  limits: { fileSize: CHAT_FILE_MAX_BYTES, files: 1 },
};

export function chatFileRelativePath(filename: string): string {
  return `/uploads/chat/${filename}`;
}

export function chatFileAbsolutePath(relative: string): string {
  const fname = relative.split('/').pop() ?? '';
  return join(CHAT_DIR, fname);
}

export function assertChatFileSize(size: number): void {
  if (size > CHAT_FILE_MAX_BYTES) {
    throw new BadRequestException('File exceeds 5 MB limit');
  }
}
