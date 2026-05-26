import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';
import { diskStorage } from 'multer';
import { randomBytes } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';

export const UPLOADS_DIR = join(process.cwd(), 'uploads');
export const MEMBERS_DIR = join(UPLOADS_DIR, 'members');
export const MEMBER_FILE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB

if (!existsSync(MEMBERS_DIR)) {
  mkdirSync(MEMBERS_DIR, { recursive: true });
}

export const memberFileStorage = diskStorage({
  destination: MEMBERS_DIR,
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase();
    const safe = randomBytes(12).toString('hex');
    cb(null, `${Date.now()}-${safe}${ext}`);
  },
});

export const memberFileFilter = (
  _req: Request,
  _file: Express.Multer.File,
  cb: (err: Error | null, accept: boolean) => void,
) => cb(null, true);

export const memberFileUploadOptions = {
  storage: memberFileStorage,
  fileFilter: memberFileFilter,
  limits: { fileSize: MEMBER_FILE_MAX_BYTES, files: 1 },
};

export function memberFileRelativePath(filename: string): string {
  return `/uploads/members/${filename}`;
}

export function memberFileAbsolutePath(relative: string): string {
  // relative looks like "/uploads/members/abc.png"
  const fname = relative.split('/').pop() ?? '';
  return join(MEMBERS_DIR, fname);
}

export function assertMemberFileSize(size: number): void {
  if (size > MEMBER_FILE_MAX_BYTES) {
    throw new BadRequestException('File exceeds 5 MB limit');
  }
}
