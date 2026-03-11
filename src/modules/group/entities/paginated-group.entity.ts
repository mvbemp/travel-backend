import { ApiProperty } from '@nestjs/swagger';
import { GroupEntity } from './group.entity';

export class PaginatedGroupEntity {
  @ApiProperty({ type: [GroupEntity] }) data: GroupEntity[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() perPage: number;
  @ApiProperty() lastPage: number;
}
