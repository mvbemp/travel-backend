import { Controller, Get, UseGuards } from '@nestjs/common';
import { UserType } from 'generated/prisma/enums';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CommonService } from './common.service';

@ApiTags('Common')
@ApiBearerAuth()
@Controller('common')
@UseGuards(JwtAuthGuard)
export class CommonController {
  constructor(private service: CommonService) {}

  @UseGuards(RolesGuard)
  @Roles(UserType.admin, UserType.super_admin)
  @Get('/expenses')
  expenses() {
    return this.service.getExpenses();
  }

  @Get('/currencies')
  currencies() {
    return this.service.getCurrencies();
  }
}
