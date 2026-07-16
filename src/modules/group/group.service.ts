import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import ExcelJS from 'exceljs';
import { promises as fsp } from 'fs';
import { UserType } from 'generated/prisma/enums';
import { __ } from 'src/common/helpers/translation.helper';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { AddGroupExpenseDto } from './dto/add-group-expense.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { PaymentService } from './payment.service';
import {
  memberFileAbsolutePath,
  memberFileRelativePath,
} from './upload.config';

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
    const where = {
      is_deleted: false,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              {
                description: { contains: search, mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.group.findMany({
        skip,
        take: perPage,
        where,
        orderBy: { created_at: 'desc' },
        include: {
          creator: { omit: { password: true } },
          currency: true,
          _count: { select: { groupMember: true } },
        },
      }),
      this.prisma.group.count({ where }),
    ]);
    return { data, total, page, perPage, lastPage: Math.ceil(total / perPage) };
  }

  async getDashboard() {
    const [total, finished, totalMembers] = await Promise.all([
      this.prisma.group.count({ where: { is_deleted: false } }),
      this.prisma.group.count({
        where: { is_finished: true, is_deleted: false },
      }),
      this.prisma.groupMember.count({
        where: { group: { is_deleted: false } },
      }),
    ]);
    return {
      total,
      finished,
      active: total - finished,
      totalMembers,
    };
  }

  async findOne(id: number, includeDeleted = false) {
    const group = await this.prisma.group.findUnique({
      where: { id },
      include: {
        creator: { omit: { password: true } },
        currency: true,
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
    if (!group || (group.is_deleted && !includeDeleted)) {
      throw new NotFoundException(__('messages.group_not_found'));
    }
    const mainCurrency = await this.prisma.currency.findFirst({
      where: { is_main: true },
    });

    const groupCurrencyChange = Number(group.currency?.currency_change) || 1;
    const groupPriceMain =
      group.price !== null && group.price !== undefined
        ? Number(group.price) / groupCurrencyChange
        : null;

    const groupMember = group.groupMember
      .map((m) => {
        const withTotal = this.withPaymentTotal(m);
        const payment_done =
          groupPriceMain !== null
            ? withTotal.payment_main_total >= groupPriceMain - 0.001
            : false;
        const payment_remaining =
          groupPriceMain !== null
            ? Math.max(groupPriceMain - withTotal.payment_main_total, 0)
            : 0;
        return { ...withTotal, payment_done, payment_remaining };
      })
      .sort((a, b) => {
        if (a.payment_done !== b.payment_done) return a.payment_done ? 1 : -1;
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();
        return bTime - aTime;
      });

    const payment_totals = this.summarizeGroupPaymentTotals(
      group.groupMember,
      mainCurrency,
    );
    return {
      ...group,
      groupMember,
      group_price_main: groupPriceMain,
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

  private async removeFileFromDisk(relativePath: string): Promise<void> {
    try {
      await fsp.unlink(memberFileAbsolutePath(relativePath));
    } catch {
      // Missing file is fine — the DB row is the source of truth.
    }
  }

  async setMemberFile(memberId: number, file: Express.Multer.File) {
    const member = await this.prisma.groupMember.findUnique({
      where: { id: memberId },
    });
    if (!member) {
      await this.removeFileFromDisk(memberFileRelativePath(file.filename));
      throw new NotFoundException(__('messages.member_not_found'));
    }

    const newPath = memberFileRelativePath(file.filename);
    const previous = member.file_path;

    const updated = await this.prisma.groupMember.update({
      where: { id: memberId },
      data: { file_path: newPath },
    });

    if (previous && previous !== newPath) {
      await this.removeFileFromDisk(previous);
    }
    return updated;
  }

  async deleteMemberFile(memberId: number) {
    const member = await this.prisma.groupMember.findUnique({
      where: { id: memberId },
    });
    if (!member) throw new NotFoundException(__('messages.member_not_found'));
    if (!member.file_path) return;

    await this.prisma.groupMember.update({
      where: { id: memberId },
      data: { file_path: null },
    });
    await this.removeFileFromDisk(member.file_path);
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

  async remove(id: number, userId: number, userType: UserType) {
    await this.findOne(id);
    if (userType !== UserType.admin && userType !== UserType.super_admin) {
      throw new ForbiddenException(__('messages.group_only_admin_delete'));
    }
    await this.prisma.group.update({
      where: { id },
      data: { is_deleted: true, deleted_at: new Date(), deleted_by: userId },
    });
  }

  async findDeleted(page: number, perPage: number, search?: string) {
    const skip = (page - 1) * perPage;
    const where = {
      is_deleted: true,
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' as const } },
              {
                description: { contains: search, mode: 'insensitive' as const },
              },
            ],
          }
        : {}),
    };
    const [data, total] = await Promise.all([
      this.prisma.group.findMany({
        skip,
        take: perPage,
        where,
        orderBy: { deleted_at: 'desc' },
        include: {
          creator: { omit: { password: true } },
          deleter: { omit: { password: true } },
          currency: true,
          _count: { select: { groupMember: true } },
        },
      }),
      this.prisma.group.count({ where }),
    ]);
    return { data, total, page, perPage, lastPage: Math.ceil(total / perPage) };
  }

  async restore(id: number) {
    const group = await this.prisma.group.findUnique({ where: { id } });
    if (!group || !group.is_deleted) {
      throw new NotFoundException(__('messages.group_not_found'));
    }
    return this.prisma.group.update({
      where: { id },
      data: { is_deleted: false, deleted_at: null, deleted_by: null },
    });
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

  async generateFinanceReport(
    groupId: number,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const group = await this.findOne(groupId, true);
    const mainCurrency = await this.prisma.currency.findFirst({
      where: { is_main: true },
    });
    const mainCode = mainCurrency?.code ?? '';

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Moliyaviy hisobot');
    sheet.columns = [
      { width: 5 },
      { width: 28 },
      { width: 16 },
      { width: 10 },
      { width: 18 },
      { width: 14 },
    ];

    const border = {
      top: { style: 'thin' as const },
      left: { style: 'thin' as const },
      bottom: { style: 'thin' as const },
      right: { style: 'thin' as const },
    };

    const formatDate = (date: Date | string | null | undefined): string => {
      if (!date) return '';
      const d = new Date(date);
      return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    };

    const addTitleRow = (title: string) => {
      const row = sheet.addRow([title]);
      sheet.mergeCells(row.number, 1, row.number, 6);
      row.font = { bold: true, size: 12 };
      row.height = 18;
      return row;
    };

    const addHeaderRow = (headers: string[]) => {
      const row = sheet.addRow(headers);
      row.font = { bold: true };
      row.alignment = { horizontal: 'center', vertical: 'middle' };
      row.eachCell((cell) => {
        cell.border = border;
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFEFEFEF' },
        };
      });
      return row;
    };

    const addDataRow = (values: (string | number)[]) => {
      const row = sheet.addRow(values);
      row.eachCell((cell) => {
        cell.border = border;
      });
      return row;
    };

    // Group header
    addTitleRow(group.name);
    sheet.addRow(['', 'Sana:', formatDate(group.date)]);
    if (group.price !== null && group.price !== undefined) {
      sheet.addRow([
        '',
        'Narx (1 kishi):',
        `${Number(group.price).toLocaleString()} ${group.currency?.code ?? ''}`,
      ]);
    }
    sheet.addRow([]);

    // Payments: every payment with the payer's full name.
    addTitleRow("YIG'ILGAN PUL (TO'LOVLAR)");
    addHeaderRow([
      '#',
      'Ism familiya',
      "To'lov",
      'Valyuta',
      `Asosiy valyutada${mainCode ? ` (${mainCode})` : ''}`,
      'Sana',
    ]);

    let paymentIndex = 0;
    let mainTotal = 0;
    const paymentsByCurrency = new Map<string, number>();
    for (const member of group.groupMember) {
      const fullName = `${(member.last_name ?? '').toUpperCase()} ${(member.first_name ?? '').toUpperCase()}`.trim();
      for (const p of member.payments ?? []) {
        const cur = p.currency ?? p.mainCurrency ?? null;
        const original = Number(p.original_payment ?? p.payment ?? 0);
        const inMain = Number(p.payment ?? 0);
        mainTotal += inMain;
        const code = cur?.code ?? '';
        paymentsByCurrency.set(
          code,
          (paymentsByCurrency.get(code) ?? 0) + original,
        );
        paymentIndex += 1;
        addDataRow([
          paymentIndex,
          fullName,
          original,
          code,
          Math.round(inMain * 100) / 100,
          formatDate(p.created_at),
        ]);
      }
    }
    if (paymentIndex === 0) {
      addDataRow(['', "To'lovlar yo'q", '', '', '', '']);
    }
    for (const [code, total] of paymentsByCurrency) {
      const row = addDataRow([
        '',
        `Jami (${code || 'valyutasiz'})`,
        Math.round(total * 100) / 100,
        code,
        '',
        '',
      ]);
      row.font = { bold: true };
    }
    const mainTotalRow = addDataRow([
      '',
      `JAMI YIG'ILGAN${mainCode ? ` (${mainCode})` : ''}`,
      '',
      '',
      Math.round(mainTotal * 100) / 100,
      '',
    ]);
    mainTotalRow.font = { bold: true };
    sheet.addRow([]);

    // Expenses with their names.
    addTitleRow('HARAJATLAR');
    addHeaderRow(['#', 'Harajat nomi', 'Qiymati', 'Valyuta', '', '']);
    const expensesByCurrency = new Map<string, number>();
    let expenseMainTotal = 0;
    (group.groupExpenses ?? []).forEach((ge, i) => {
      const code = ge.expense?.currency?.code ?? '';
      const value = Number(ge.value ?? 0);
      const rate = Number(ge.expense?.currency?.currency_change) || 1;
      expenseMainTotal += value / rate;
      expensesByCurrency.set(
        code,
        (expensesByCurrency.get(code) ?? 0) + value,
      );
      addDataRow([
        i + 1,
        ge.expense?.name ?? '',
        value,
        code,
        '',
        '',
      ]);
    });
    if ((group.groupExpenses ?? []).length === 0) {
      addDataRow(['', "Harajatlar yo'q", '', '', '', '']);
    }
    for (const [code, total] of expensesByCurrency) {
      const row = addDataRow([
        '',
        `Jami harajat (${code || 'valyutasiz'})`,
        Math.round(total * 100) / 100,
        code,
        '',
        '',
      ]);
      row.font = { bold: true };
    }
    sheet.addRow([]);

    // Summary
    addTitleRow('XULOSA');
    const summaryCollected = addDataRow([
      '',
      "Jami yig'ilgan",
      Math.round(mainTotal * 100) / 100,
      mainCode,
      '',
      '',
    ]);
    summaryCollected.font = { bold: true };
    const summaryExpense = addDataRow([
      '',
      'Jami harajat',
      Math.round(expenseMainTotal * 100) / 100,
      mainCode,
      '',
      '',
    ]);
    summaryExpense.font = { bold: true };
    const profitRow = addDataRow([
      '',
      'Foyda',
      Math.round((mainTotal - expenseMainTotal) * 100) / 100,
      mainCode,
      '',
      '',
    ]);
    profitRow.font = { bold: true };

    const raw = await workbook.xlsx.writeBuffer();
    const safeName =
      group.name.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || `group-${groupId}`;
    return {
      buffer: Buffer.from(raw),
      filename: `${safeName}-moliyaviy-hisobot.xlsx`,
    };
  }
}
