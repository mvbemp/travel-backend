import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { __ } from 'src/common/helpers/translation.helper';

@Injectable()
export class UserService {
  constructor (
    private readonly prisma: PrismaService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });
    if (existing) throw new ConflictException(__('messages.email_unique'));

    return this.prisma.user.create({ data: createUserDto });
  }

  async findAll(page: number, perPage: number, search?: string) {
    const skip = (page - 1) * perPage;
    const where = search
      ? {
          OR: [
            { full_name: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            { phone_number: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: perPage,
        where,
        omit: { password: true },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { data, total, page, perPage, lastPage: Math.ceil(total / perPage) };
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      omit: { password: true },
    });
    if (!user) throw new NotFoundException(__('messages.user_not_found'));
    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    await this.findOne(id);
    if (id === 1 && updateUserDto.type !== undefined) {
      throw new ForbiddenException(__('messages.user_cannot_change_type'));
    }
    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      omit: { password: true },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    if (id === 1) throw new ForbiddenException(__('messages.user_cannot_delete'));
    await this.prisma.user.delete({ where: { id } });
  }
}
