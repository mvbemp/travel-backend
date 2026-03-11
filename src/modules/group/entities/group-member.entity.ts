import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PassportType } from 'generated/prisma/enums';

export class GroupMemberEntity {
  @ApiProperty() id: number;
  @ApiProperty() group_id: number;
  @ApiProperty() name: string;
  @ApiPropertyOptional() passport?: string;
  @ApiPropertyOptional({ enum: PassportType }) passport_type?: PassportType;
  @ApiProperty() created_by: number;
  @ApiProperty() payment: number;
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
}
