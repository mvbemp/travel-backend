import { Module } from '@nestjs/common';
import { PrismaModule } from 'src/core/prisma/prisma.module';
import { GroupController } from './group.controller';
import { GroupService } from './group.service';
import {
  MemberPaymentController,
  PaymentController,
} from './payment.controller';
import { PaymentService } from './payment.service';

@Module({
  imports: [PrismaModule],
  controllers: [GroupController, MemberPaymentController, PaymentController],
  providers: [GroupService, PaymentService],
})
export class GroupModule {}
