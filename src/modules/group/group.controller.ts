import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { UserType } from 'generated/prisma/enums';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AddGroupExpenseDto } from './dto/add-group-expense.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { GroupMemberEntity } from './entities/group-member.entity';
import { GroupEntity } from './entities/group.entity';
import { PaginatedGroupEntity } from './entities/paginated-group.entity';
import { GroupService } from './group.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { memberFileUploadOptions } from './upload.config';

@ApiTags('Groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('groups')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @UseGuards(RolesGuard)
  @Roles(UserType.admin, UserType.super_admin)
  @Post()
  @ApiOkResponse({ type: GroupEntity })
  create(@Body() dto: CreateGroupDto, @CurrentUser() user: { id: number }) {
    return this.groupService.create(dto, user.id);
  }

  @Get()
  @ApiOkResponse({ type: PaginatedGroupEntity })
  findAll(
    @Query('page') page = 1,
    @Query('perPage') perPage = 15,
    @Query('search') search?: string,
  ) {
    return this.groupService.findAll(+page, +perPage, search);
  }

  @Get('dashboard')
  getDashboard() {
    return this.groupService.getDashboard();
  }

  @UseGuards(RolesGuard)
  @Roles(UserType.super_admin)
  @Get('deleted')
  @ApiOkResponse({ type: PaginatedGroupEntity })
  findDeleted(
    @Query('page') page = 1,
    @Query('perPage') perPage = 15,
    @Query('search') search?: string,
  ) {
    return this.groupService.findDeleted(+page, +perPage, search);
  }

  @Get(':id')
  @ApiOkResponse({ type: GroupEntity })
  findOne(@Param('id') id: string) {
    return this.groupService.findOne(+id);
  }

  @Get(':id/report')
  async downloadReport(@Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } = await this.groupService.generateReport(+id);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }

  @UseGuards(RolesGuard)
  @Roles(UserType.super_admin)
  @Get(':id/finance-report')
  async downloadFinanceReport(@Param('id') id: string, @Res() res: Response) {
    const { buffer, filename } =
      await this.groupService.generateFinanceReport(+id);
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.send(buffer);
  }

  @UseGuards(RolesGuard)
  @Roles(UserType.super_admin)
  @Patch(':id/restore')
  @ApiOkResponse({ type: GroupEntity })
  restore(@Param('id') id: string) {
    return this.groupService.restore(+id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserType.admin, UserType.super_admin)
  @Get(':id/members/deleted')
  getDeletedMembers(@Param('id') id: string) {
    return this.groupService.getDeletedMembers(+id);
  }

  @Post(':id/members')
  @ApiOkResponse({ type: GroupMemberEntity })
  addMember(
    @Param('id') id: string,
    @Body() dto: AddMemberDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.groupService.addMember(+id, dto, user.id);
  }

  @Patch(':groupId/members/:memberId')
  @ApiOkResponse({ type: GroupMemberEntity })
  updateMember(
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.groupService.updateMember(+memberId, dto);
  }

  @Delete(':groupId/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @Param('memberId') memberId: string,
    @CurrentUser() user: { id: number; type: UserType },
  ) {
    return this.groupService.removeMember(+memberId, user.id, user.type);
  }

  @Post(':groupId/members/:memberId/file')
  @UseInterceptors(FileInterceptor('file', memberFileUploadOptions))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
      required: ['file'],
    },
  })
  @ApiOkResponse({ type: GroupMemberEntity })
  uploadMemberFile(
    @Param('memberId') memberId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('File is required');
    return this.groupService.setMemberFile(+memberId, file);
  }

  @UseGuards(RolesGuard)
  @Roles(UserType.admin, UserType.super_admin)
  @Delete(':groupId/members/:memberId/file')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteMemberFile(@Param('memberId') memberId: string) {
    return this.groupService.deleteMemberFile(+memberId);
  }

  @Post(':id/expenses')
  addExpense(@Param('id') id: string, @Body() dto: AddGroupExpenseDto) {
    return this.groupService.addExpense(+id, dto);
  }

  @Delete(':id/expenses/:expenseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeExpense(@Param('expenseId') expenseId: string) {
    return this.groupService.removeExpense(+expenseId);
  }

  @UseGuards(RolesGuard)
  @Roles(UserType.admin, UserType.super_admin)
  @Patch(':id')
  @ApiOkResponse({ type: GroupEntity })
  update(@Param('id') id: string, @Body() dto: UpdateGroupDto) {
    return this.groupService.update(+id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles(UserType.admin, UserType.super_admin)
  @Patch(':id/finish')
  @ApiOkResponse({ type: GroupEntity })
  finish(@Param('id') id: string) {
    return this.groupService.finish(+id);
  }

  @UseGuards(RolesGuard)
  @Roles(UserType.admin, UserType.super_admin)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: number; type: UserType },
  ) {
    return this.groupService.remove(+id, user.id, user.type);
  }
}
