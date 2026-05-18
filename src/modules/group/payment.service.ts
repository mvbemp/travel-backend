import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserType } from 'generated/prisma/enums';
import { __ } from 'src/common/helpers/translation.helper';
import { PrismaService } from 'src/core/prisma/prisma.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Injectable()
export class PaymentService {
  constructor(private readonly prisma: PrismaService) {}

  private async resolveCurrency(currencyId?: number | null) {
    if (!currencyId) {
      return this.prisma.currency.findFirst({ where: { is_main: true } });
    }
    return this.prisma.currency.findUnique({ where: { id: currencyId } });
  }

  private getMainCurrency() {
    return this.prisma.currency.findFirst({ where: { is_main: true } });
  }

  private toMainCurrency(amount: number, currencyRate: number): number {
    return currencyRate === 0 ? amount : amount / currencyRate;
  }

  private canModify(
    payment: { created_by: number },
    userId: number,
    userType: UserType,
  ): boolean {
    if (userType === UserType.super_admin || userType === UserType.admin)
      return true;
    return payment.created_by === userId;
  }

  async listForMember(groupId: number, memberId: number) {
    const member = await this.prisma.groupMember.findFirst({
      where: { id: memberId, group_id: groupId },
    });
    if (!member) throw new NotFoundException(__('messages.member_not_found'));
    return this.prisma.groupMemberPayment.findMany({
      where: { group_member_id: memberId, deleted_at: null },
      include: {
        currency: true,
        mainCurrency: true,
        creator: { omit: { password: true } },
      },
      orderBy: { created_at: 'asc' },
    });
  }

  async create(
    groupId: number,
    memberId: number,
    dto: CreatePaymentDto,
    userId: number,
  ) {
    const member = await this.prisma.groupMember.findFirst({
      where: { id: memberId, group_id: groupId },
    });
    if (!member) throw new NotFoundException(__('messages.member_not_found'));

    const currency = await this.resolveCurrency(dto.currency_id);
    const mainCurrency = await this.getMainCurrency();
    const currency_rate = Number(currency?.currency_change) || 1;
    const original_payment = Number(dto.payment) || 0;
    const payment = this.toMainCurrency(original_payment, currency_rate);

    return this.prisma.groupMemberPayment.create({
      data: {
        group_member_id: memberId,
        created_by: userId,
        currency_id: currency?.id,
        currency_rate,
        main_currency_id: mainCurrency?.id ?? null,
        payment,
        original_payment,
      },
      include: {
        currency: true,
        mainCurrency: true,
        creator: { omit: { password: true } },
      },
    });
  }

  async update(
    paymentId: number,
    dto: UpdatePaymentDto,
    userId: number,
    userType: UserType,
  ) {
    const existing = await this.prisma.groupMemberPayment.findUnique({
      where: { id: paymentId },
    });
    if (!existing || existing.deleted_at)
      throw new NotFoundException(__('messages.payment_not_found'));
    if (!this.canModify(existing, userId, userType)) {
      throw new ForbiddenException(
        __('messages.payment_only_creator_or_admin'),
      );
    }

    const currencyId =
      dto.currency_id !== undefined ? dto.currency_id : existing.currency_id;
    const currency = await this.resolveCurrency(currencyId);
    const mainCurrency = await this.getMainCurrency();
    const currency_rate = Number(currency?.currency_change) || 1;
    const original_payment =
      dto.payment !== undefined
        ? Number(dto.payment)
        : Number(existing.original_payment);
    const payment = this.toMainCurrency(original_payment, currency_rate);

    return this.prisma.groupMemberPayment.update({
      where: { id: paymentId },
      data: {
        currency_id: currency?.id,
        currency_rate,
        main_currency_id: mainCurrency?.id ?? null,
        original_payment,
        payment,
      },
      include: {
        currency: true,
        mainCurrency: true,
        creator: { omit: { password: true } },
      },
    });
  }

  async remove(paymentId: number, userId: number, userType: UserType) {
    const existing = await this.prisma.groupMemberPayment.findUnique({
      where: { id: paymentId },
    });
    if (!existing || existing.deleted_at)
      throw new NotFoundException(__('messages.payment_not_found'));
    if (!this.canModify(existing, userId, userType)) {
      throw new ForbiddenException(
        __('messages.payment_only_creator_or_admin'),
      );
    }
    await this.prisma.groupMemberPayment.update({
      where: { id: paymentId },
      data: { deleted_at: new Date(), deleted_by: userId },
    });
  }
}
