import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/core/prisma/prisma.service';

@Injectable()
export class UserService {
  constructor (
    private readonly prisma: PrismaService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });
    if (existing) throw new ConflictException('User with this email already exists');

    return this.prisma.user.create({ data: createUserDto });
  }

  async findAll() {
    return this.prisma.user.findMany({ omit: { password: true } });
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      omit: { password: true },
    });
    if (!user) throw new NotFoundException(`User #${id} not found`);
    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto) {
    await this.findOne(id);
    if (id === 1 && updateUserDto.type !== undefined) {
      throw new ForbiddenException('Cannot change type of this user');
    }
    return this.prisma.user.update({
      where: { id },
      data: updateUserDto,
      omit: { password: true },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    if (id === 1) throw new ForbiddenException('Cannot delete this user');
    await this.prisma.user.delete({ where: { id } });
  }
}
