import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { GroupMemberEntity } from './group-member.entity';
import { UserShortEntity } from './user-short.entity';

export class GroupEntity {
  @ApiProperty() id: number;
  @ApiProperty() name: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() date: Date;
  @ApiProperty() is_finished: boolean;
  @ApiProperty() created_by: number;
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
  @ApiProperty({ type: UserShortEntity }) creator: UserShortEntity;
  @ApiProperty({ type: [GroupMemberEntity] }) groupMember: GroupMemberEntity[];
}
