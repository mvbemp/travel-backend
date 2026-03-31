import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { UserType } from 'generated/prisma/enums';
import { __ } from 'src/common/helpers/translation.helper';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { AddGroupExpenseDto } from './dto/add-group-expense.dto';
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
        groupMember: { where: { is_deleted: false }, include: { currency: true, creator: { omit: { password: true } } } },
        groupExpenses: { include: { expense: { include: { currency: true } } }, orderBy: { created_at: 'asc' } },
      },
    });
    if (!group) throw new NotFoundException(__('messages.group_not_found'));
    return group;
  }

  async addExpense(groupId: number, dto: AddGroupExpenseDto) {
    await this.findOne(groupId);
    const expense = await this.prisma.expense.findUnique({ where: { id: dto.expense_id } });
    if (!expense) throw new NotFoundException(__('messages.not_found'));
    return this.prisma.groupExpense.create({
      data: { group_id: groupId, expense_id: dto.expense_id, value: dto.value },
      include: { expense: { include: { currency: true } } },
    });
  }

  async removeExpense(groupExpenseId: number) {
    const ge = await this.prisma.groupExpense.findUnique({ where: { id: groupExpenseId } });
    if (!ge) throw new NotFoundException(__('messages.not_found'));
    await this.prisma.groupExpense.delete({ where: { id: groupExpenseId } });
  }

  private async resolveCurrency(currencyId?: number | null) {
    if (!currencyId) {
      return this.prisma.currency.findFirst({ where: { is_main: true } });
    }
    return this.prisma.currency.findUnique({ where: { id: currencyId } });
  }

  private toMainCurrency(amount: number, currencyRate: number): number {
    return currencyRate === 0 ? amount : amount / currencyRate;
  }

  async addMember(groupId: number, dto: AddMemberDto, userId: number) {
    await this.findOne(groupId);
    const currency = await this.resolveCurrency(dto.currency_id);
    const currency_rate = Number(currency?.currency_change) || 1;
    const original_payment = Number(dto.payment) || 0;
    const payment = this.toMainCurrency(original_payment, currency_rate);
    return this.prisma.groupMember.create({
      data: { ...dto, group_id: groupId, created_by: userId, currency_id: currency?.id, currency_rate, payment, original_payment },
      include: { currency: true },
    });
  }

  async updateMember(memberId: number, dto: UpdateMemberDto) {
    const member = await this.prisma.groupMember.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException(__('messages.member_not_found'));
    const currencyId = dto.currency_id !== undefined ? dto.currency_id : member.currency_id;
    const currency = await this.resolveCurrency(currencyId);
    const currency_rate = Number(currency?.currency_change) || 1;
    const original_payment = dto.payment !== undefined ? Number(dto.payment) : undefined;
    const payment = original_payment !== undefined
      ? this.toMainCurrency(original_payment, currency_rate)
      : undefined;
    return this.prisma.groupMember.update({
      where: { id: memberId },
      data: {
        ...dto,
        currency_rate,
        ...(original_payment !== undefined && { original_payment, payment }),
      },
      include: { currency: true },
    });
  }

  async removeMember(memberId: number, userId: number, userType: UserType) {
    const member = await this.prisma.groupMember.findUnique({ where: { id: memberId } });
    if (!member) throw new NotFoundException(__('messages.member_not_found'));
    if (member.created_by !== userId && userType !== UserType.admin && userType !== UserType.super_admin) {
      throw new ForbiddenException(__('messages.member_only_creator_or_admin_delete'));
    }
    await this.prisma.groupMember.update({ where: { id: memberId }, data: { is_deleted: true, deleted_by: userId } });
  }

  async getDeletedMembers(groupId: number) {
    await this.findOne(groupId);
    return this.prisma.groupMember.findMany({
      where: { group_id: groupId, is_deleted: true },
      include: { currency: true, creator: { omit: { password: true } }, deleter: { omit: { password: true } } },
      orderBy: { updated_at: 'desc' },
    });
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

  async generateReport(groupId: number): Promise<{ buffer: Buffer; filename: string }> {
    const group = await this.findOne(groupId);
    const members = group.groupMember;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Members');

    const border = {
      top: { style: 'thin' as const }, left: { style: 'thin' as const },
      bottom: { style: 'thin' as const }, right: { style: 'thin' as const },
    };

    const headers = ['#', 'Surname', 'Name', 'PAX type', 'Nationality', 'Passport #', 'Date of Birth', 'Gender', 'Date of Expiry'];
    const widths =  [5,   18,        18,     10,          13,            14,            15,               9,        15];

    sheet.columns = headers.map((header, i) => ({ header, key: String(i), width: widths[i] }));

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 16;
    headerRow.eachCell(cell => { cell.border = border; });

    const formatDate = (date: Date | string | null | undefined): string => {
      if (!date) return '';
      const d = new Date(date);
      return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    };

    members.forEach((m, i) => {
      const row = sheet.addRow([
        i + 1,
        (m.last_name ?? '').toUpperCase(),
        (m.first_name ?? '').toUpperCase(),
        m.pax_type ?? '',
        (m.nationality ?? '').toUpperCase(),
        m.passport ?? '',
        formatDate(m.date_of_birth),
        m.gender === 'male' ? 'M' : m.gender === 'female' ? 'F' : '',
        formatDate(m.date_of_expiry),
      ]);
      row.alignment = { horizontal: 'center', vertical: 'middle' };
      row.eachCell(cell => { cell.border = border; });
    });

    const raw = await workbook.xlsx.writeBuffer();
    const safeName = group.name.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || `group-${groupId}`;
    return { buffer: Buffer.from(raw), filename: `${safeName}.xlsx` };
  }
}
