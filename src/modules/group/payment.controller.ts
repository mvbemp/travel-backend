import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { UserType } from 'generated/prisma/enums';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { GroupMemberPaymentEntity } from './entities/group-member-payment.entity';
import { PaymentService } from './payment.service';

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('groups/:groupId/members/:memberId/payments')
export class MemberPaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Get()
  @ApiOkResponse({ type: [GroupMemberPaymentEntity] })
  list(@Param('groupId') groupId: string, @Param('memberId') memberId: string) {
    return this.paymentService.listForMember(+groupId, +memberId);
  }

  @Post()
  @ApiOkResponse({ type: GroupMemberPaymentEntity })
  create(
    @Param('groupId') groupId: string,
    @Param('memberId') memberId: string,
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.paymentService.create(+groupId, +memberId, dto, user.id);
  }
}

@ApiTags('Payments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Patch(':id')
  @ApiOkResponse({ type: GroupMemberPaymentEntity })
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentDto,
    @CurrentUser() user: { id: number; type: UserType },
  ) {
    return this.paymentService.update(+id, dto, user.id, user.type);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: number; type: UserType },
  ) {
    return this.paymentService.remove(+id, user.id, user.type);
  }
}
