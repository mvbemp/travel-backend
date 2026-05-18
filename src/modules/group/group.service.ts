import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import ExcelJS from 'exceljs';
import { UserType } from 'generated/prisma/enums';
import { __ } from 'src/common/helpers/translation.helper';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { AddGroupExpenseDto } from './dto/add-group-expense.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { PaymentService } from './payment.service';

type PaymentLike = {
  payment: unknown;
  original_payment?: unknown;
  currency_rate?: unknown;
  currency_id?: number | null;
  main_currency_id?: number | null;
  currency?: { id: number; code: string; symbol: string } | null;
  mainCurrency?: { id: number; code: string; symbol: string } | null;
};

type MemberWithPayments = { payments?: PaymentLike[] };

export interface CurrencyTotal {
  currency_id: number | null;
  code: string;
  symbol: string;
  total: number;
}

export interface MainCurrencySummary {
  currency_id: number | null;
  code: string | null;
  symbol: string | null;
  total: number;
}

@Injectable()
export class GroupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
  ) {}

  private withPaymentTotal<T extends MemberWithPayments>(
    member: T,
  ): T & {
    payment: number;
    payment_main_total: number;
    payments_by_currency: CurrencyTotal[];
  } {
    const payments = member.payments ?? [];
    const total = payments.reduce((sum, p) => sum + Number(p.payment ?? 0), 0);

    // Aggregate original-currency totals so the UI can show "paid 100 USD + 50 EUR".
    const byCurrency = new Map<string, CurrencyTotal>();
    for (const p of payments) {
      const cur = p.currency ?? p.mainCurrency ?? null;
      const key = cur ? String(cur.id) : 'unknown';
      const existing = byCurrency.get(key);
      const amount = Number(p.original_payment ?? p.payment ?? 0);
      if (existing) {
        existing.total += amount;
      } else {
        byCurrency.set(key, {
          currency_id: cur?.id ?? null,
          code: cur?.code ?? '',
          symbol: cur?.symbol ?? '',
          total: amount,
        });
      }
    }

    return {
      ...member,
      payment: total,
      payment_main_total: total,
      payments_by_currency: Array.from(byCurrency.values()),
    };
  }

  private summarizeGroupPaymentTotals(
    members: { payments?: PaymentLike[] }[],
    mainCurrency: {
      id: number;
      code: string;
      symbol: string;
    } | null,
  ): {
    by_currency: CurrencyTotal[];
    main_currency_total: MainCurrencySummary;
  } {
    const byCurrency = new Map<string, CurrencyTotal>();
    let mainTotal = 0;

    for (const m of members) {
      for (const p of m.payments ?? []) {
        const cur = p.currency ?? p.mainCurrency ?? null;
        const key = cur ? String(cur.id) : 'unknown';
        const existing = byCurrency.get(key);
        const original = Number(p.original_payment ?? p.payment ?? 0);
        if (existing) {
          existing.total += original;
        } else {
          byCurrency.set(key, {
            currency_id: cur?.id ?? null,
            code: cur?.code ?? '',
            symbol: cur?.symbol ?? '',
            total: original,
          });
        }
        mainTotal += Number(p.payment ?? 0);
      }
    }

    return {
      by_currency: Array.from(byCurrency.values()),
      main_currency_total: {
        currency_id: mainCurrency?.id ?? null,
        code: mainCurrency?.code ?? null,
        symbol: mainCurrency?.symbol ?? null,
        total: mainTotal,
      },
    };
  }

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
        groupMember: {
          where: { is_deleted: false },
          include: {
            creator: { omit: { password: true } },
            payments: {
              where: { deleted_at: null },
              include: {
                currency: true,
                mainCurrency: true,
                creator: { omit: { password: true } },
              },
              orderBy: { created_at: 'asc' },
            },
          },
        },
        groupExpenses: {
          include: { expense: { include: { currency: true } } },
          orderBy: { created_at: 'asc' },
        },
      },
    });
    if (!group) throw new NotFoundException(__('messages.group_not_found'));
    const mainCurrency = await this.prisma.currency.findFirst({
      where: { is_main: true },
    });
    const groupMember = group.groupMember.map((m) => this.withPaymentTotal(m));
    const payment_totals = this.summarizeGroupPaymentTotals(
      group.groupMember,
      mainCurrency,
    );
    return {
      ...group,
      groupMember,
      payment_totals,
    };
  }

  async addExpense(groupId: number, dto: AddGroupExpenseDto) {
    await this.findOne(groupId);
    const expense = await this.prisma.expense.findUnique({
      where: { id: dto.expense_id },
    });
    if (!expense) throw new NotFoundException(__('messages.not_found'));
    return this.prisma.groupExpense.create({
      data: { group_id: groupId, expense_id: dto.expense_id, value: dto.value },
      include: { expense: { include: { currency: true } } },
    });
  }

  async removeExpense(groupExpenseId: number) {
    const ge = await this.prisma.groupExpense.findUnique({
      where: { id: groupExpenseId },
    });
    if (!ge) throw new NotFoundException(__('messages.not_found'));
    await this.prisma.groupExpense.delete({ where: { id: groupExpenseId } });
  }

  async addMember(groupId: number, dto: AddMemberDto, userId: number) {
    await this.findOne(groupId);
    const { payment, currency_id, ...memberData } = dto;

    const member = await this.prisma.groupMember.create({
      data: {
        ...memberData,
        group_id: groupId,
        created_by: userId,
      },
    });

    const initialAmount = Number(payment) || 0;
    if (initialAmount > 0) {
      await this.paymentService.create(
        groupId,
        member.id,
        { payment: initialAmount, currency_id },
        userId,
      );
    }

    const full = await this.prisma.groupMember.findUnique({
      where: { id: member.id },
      include: {
        creator: { omit: { password: true } },
        payments: {
          where: { deleted_at: null },
          include: {
            currency: true,
            creator: { omit: { password: true } },
          },
          orderBy: { created_at: 'asc' },
        },
      },
    });
    return this.withPaymentTotal(full!);
  }

  async updateMember(memberId: number, dto: UpdateMemberDto) {
    const member = await this.prisma.groupMember.findUnique({
      where: { id: memberId },
    });
    if (!member) throw new NotFoundException(__('messages.member_not_found'));
    const updated = await this.prisma.groupMember.update({
      where: { id: memberId },
      data: { ...dto },
      include: {
        creator: { omit: { password: true } },
        payments: {
          where: { deleted_at: null },
          include: {
            currency: true,
            creator: { omit: { password: true } },
          },
          orderBy: { created_at: 'asc' },
        },
      },
    });
    return this.withPaymentTotal(updated);
  }

  async removeMember(memberId: number, userId: number, userType: UserType) {
    const member = await this.prisma.groupMember.findUnique({
      where: { id: memberId },
    });
    if (!member) throw new NotFoundException(__('messages.member_not_found'));
    if (
      member.created_by !== userId &&
      userType !== UserType.admin &&
      userType !== UserType.super_admin
    ) {
      throw new ForbiddenException(
        __('messages.member_only_creator_or_admin_delete'),
      );
    }
    await this.prisma.groupMember.update({
      where: { id: memberId },
      data: { is_deleted: true, deleted_by: userId },
    });
  }

  async getDeletedMembers(groupId: number) {
    await this.findOne(groupId);
    const members = await this.prisma.groupMember.findMany({
      where: { group_id: groupId, is_deleted: true },
      include: {
        creator: { omit: { password: true } },
        deleter: { omit: { password: true } },
        payments: {
          where: { deleted_at: null },
          include: { currency: true, mainCurrency: true },
          orderBy: { created_at: 'asc' },
        },
      },
      orderBy: { updated_at: 'desc' },
    });
    return members.map((m) => this.withPaymentTotal(m));
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
    return this.prisma.group.update({
      where: { id },
      data: { is_finished: true },
    });
  }

  async remove(id: number, userType: UserType) {
    await this.findOne(id);
    if (userType !== UserType.admin) {
      throw new ForbiddenException(__('messages.group_only_admin_delete'));
    }
    await this.prisma.group.delete({ where: { id } });
  }

  async generateReport(
    groupId: number,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const group = await this.findOne(groupId);
    const members = group.groupMember;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Members');

    const border = {
      top: { style: 'thin' as const },
      left: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      right: { style: 'thin' as const },
    };

    const headers = [
      '#',
      'Surname',
      'Name',
      'PAX type',
      'Nationality',
      'Passport #',
      'Date of Birth',
      'Gender',
      'Date of Expiry',
    ];
    const widths = [5, 18, 18, 10, 13, 14, 15, 9, 15];

    sheet.columns = headers.map((header, i) => ({
      header,
      key: String(i),
      width: widths[i],
    }));

    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
    headerRow.height = 16;
    headerRow.eachCell((cell) => {
      cell.border = border;
    });

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
      row.eachCell((cell) => {
        cell.border = border;
      });
    });

    const raw = await workbook.xlsx.writeBuffer();
    const safeName =
      group.name.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || `group-${groupId}`;
    return { buffer: Buffer.from(raw), filename: `${safeName}.xlsx` };
  }
}
