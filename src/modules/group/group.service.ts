import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { UserType } from 'generated/prisma/enums';
import { __ } from 'src/common/helpers/translation.helper';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { UpdateMemberDto } from './dto/update-member.dto';

@Injectable()
export class GroupService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateGroupDto, userId: number) {
    return this.prisma.group.create({
      data: { ...dto, date: new Date(dto.date), created_by: userId },
    });
  }

  async findAll(page: number, perPage: number, search?: string) {
    const skip = (page - 1) * perPage;
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};
    const [data, total] = await Promise.all([
      this.prisma.group.findMany({
        skip,
        take: perPage,
        where,
        orderBy: { created_at: 'desc' },
        include: {
          creator: { omit: { password: true } },
          _count: { select: { groupMember: true } },
        },
      }),
      this.prisma.group.count({ where }),
    ]);
    return { data, total, page, perPage, lastPage: Math.ceil(total / perPage) };
  }

  async getDashboard() {
    const [total, finished, totalMembers] = await Promise.all([
      this.prisma.group.count(),
      this.prisma.group.count({ where: { is_finished: true } }),
      this.prisma.groupMember.count(),
    ]);
    return {
      total,
      finished,
      active: total - finished,
      totalMembers,
    };
  }

  async findOne(id: number) {
    const group = await this.prisma.group.findUnique({
      where: { id },
      include: {
        creator: { omit: { password: true } },
        groupMember: { include: { currency: true } },
      },
    });
    if (!group) throw new NotFoundException(__('messages.group_not_found'));
    return group;
  }

  async addMember(groupId: number, dto: AddMemberDto, userId: number) {
    await this.findOne(groupId);
    let currencyId = dto.currency_id;
    if (!currencyId) {
      const usd = await this.prisma.currency.findFirst({ where: { code: 'USD' } });
      currencyId = usd?.id;
    }
    return this.prisma.groupMember.create({
      data: { ...dto, group_id: groupId, created_by: userId, currency_id: currencyId },
      include: { currency: true },
    });
  }

  async updateMember(memberId: number, dto: UpdateMemberDto) {
    const member = await this.prisma.groupMember.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException(__('messages.member_not_found'));
    return this.prisma.groupMember.update({
      where: { id: memberId },
      data: dto,
      include: { currency: true },
    });
  }

  async removeMember(memberId: number, userId: number, userType: UserType) {
    const member = await this.prisma.groupMember.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException(__('messages.member_not_found'));
    if (member.created_by !== userId && userType !== UserType.admin) {
      throw new ForbiddenException(__('messages.member_only_creator_or_admin_delete'));
    }
    await this.prisma.groupMember.delete({ where: { id: memberId } });
  }

  async update(id: number, dto: UpdateGroupDto) {
    await this.findOne(id);
    return this.prisma.group.update({
      where: { id },
      data: { ...dto, ...(dto.date && { date: new Date(dto.date) }) },
    });
  }

  async finish(id: number) {
    await this.findOne(id);
    return this.prisma.group.update({ where: { id }, data: { is_finished: true } });
  }

  async remove(id: number, userType: UserType) {
    await this.findOne(id);
    if (userType !== UserType.admin) {
      throw new ForbiddenException(__('messages.group_only_admin_delete'));
    }
    await this.prisma.group.delete({ where: { id } });
  }
}
