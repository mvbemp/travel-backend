import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { __ } from 'src/common/helpers/translation.helper';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Injectable()
export class ExpenseService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createExpenseDto: CreateExpenseDto) {
    const existing = await this.prisma.expense.findUnique({
      where: { name: createExpenseDto.name },
    });
    if (existing) throw new ConflictException(__('messages.already_exists'));

    return this.prisma.expense.create({
      data: createExpenseDto,
      include: { currency: true },
    });
  }

  async findAll(page?: number, perPage?: number, search?: string) {
    if (page === undefined || perPage === undefined) {
      return this.prisma.expense.findMany({ include: { currency: true } });
    }
    const where = search
      ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { currency: { code: { contains: search, mode: 'insensitive' as const } } },
          ],
        }
      : {};
    const skip = (page - 1) * perPage;
    const [data, total] = await Promise.all([
      this.prisma.expense.findMany({ where, skip, take: perPage, orderBy: { id: 'asc' }, include: { currency: true } }),
      this.prisma.expense.count({ where }),
    ]);
    return { data, total, page, perPage, lastPage: Math.ceil(total / perPage) };
  }

  async findOne(id: number) {
    const expense = await this.prisma.expense.findUnique({
      where: { id },
      include: { currency: true },
    });
    if (!expense) throw new NotFoundException(__('messages.not_found'));
    return expense;
  }

  async update(id: number, updateExpenseDto: UpdateExpenseDto) {
    await this.findOne(id);

    if (updateExpenseDto.name) {
      const conflict = await this.prisma.expense.findFirst({
        where: { name: updateExpenseDto.name, NOT: { id } },
      });
      if (conflict) throw new ConflictException(__('messages.already_exists'));
    }

    return this.prisma.expense.update({
      where: { id },
      data: updateExpenseDto,
      include: { currency: true },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.expense.delete({ where: { id } });
  }
}
