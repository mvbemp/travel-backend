import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
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

@ApiTags('Groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('groups')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

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

  @Get(':id')
  @ApiOkResponse({ type: GroupEntity })
  findOne(@Param('id') id: string) {
    return this.groupService.findOne(+id);
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
  updateMember(@Param('memberId') memberId: string, @Body() dto: UpdateMemberDto) {
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

  @Post(':id/expenses')
  addExpense(@Param('id') id: string, @Body() dto: AddGroupExpenseDto) {
    return this.groupService.addExpense(+id, dto);
  }

  @Delete(':id/expenses/:expenseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeExpense(@Param('expenseId') expenseId: string) {
    return this.groupService.removeExpense(+expenseId);
  }

  @Patch(':id')
  @ApiOkResponse({ type: GroupEntity })
  update(@Param('id') id: string, @Body() dto: UpdateGroupDto) {
    return this.groupService.update(+id, dto);
  }

  @Patch(':id/finish')
  @ApiOkResponse({ type: GroupEntity })
  finish(@Param('id') id: string) {
    return this.groupService.finish(+id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id') id: string,
    @CurrentUser() user: { id: number; type: UserType },
  ) {
    return this.groupService.remove(+id, user.type);
  }
}
