import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { __ } from 'src/common/helpers/translation.helper';
import { CreateCurrencyDto } from './dto/create-currency.dto';
import { UpdateCurrencyDto } from './dto/update-currency.dto';

@Injectable()
export class CurrencyService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createCurrencyDto: CreateCurrencyDto) {
    const existing = await this.prisma.currency.findFirst({
      where: {
        OR: [
          { code: createCurrencyDto.code },
          { symbol: createCurrencyDto.symbol },
          { country: createCurrencyDto.country },
        ],
      },
    });
    if (existing) throw new ConflictException(__('messages.already_exists'));

    return this.prisma.currency.create({ data: createCurrencyDto });
  }

  async findAll() {
    return this.prisma.currency.findMany();
  }

  async findOne(id: number) {
    const currency = await this.prisma.currency.findUnique({ where: { id } });
    if (!currency) throw new NotFoundException(__('messages.not_found'));
    return currency;
  }

  async update(id: number, updateCurrencyDto: UpdateCurrencyDto) {
    await this.findOne(id);

    if (updateCurrencyDto.code || updateCurrencyDto.symbol || updateCurrencyDto.country) {
      const conditions: { code?: string; symbol?: string; country?: string }[] = [];
      if (updateCurrencyDto.code) conditions.push({ code: updateCurrencyDto.code });
      if (updateCurrencyDto.symbol) conditions.push({ symbol: updateCurrencyDto.symbol });
      if (updateCurrencyDto.country) conditions.push({ country: updateCurrencyDto.country });

      const conflict = await this.prisma.currency.findFirst({
        where: { OR: conditions, NOT: { id } },
      });
      if (conflict) throw new ConflictException(__('messages.already_exists'));
    }

    return this.prisma.currency.update({ where: { id }, data: updateCurrencyDto });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.currency.delete({ where: { id } });
  }
}
