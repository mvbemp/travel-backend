import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Gender, PaxType } from 'generated/prisma/enums';

export class GroupMemberEntity {
  @ApiProperty() id: number;
  @ApiProperty() group_id: number;
  @ApiProperty() first_name: string;
  @ApiProperty() last_name: string;
  @ApiPropertyOptional({ enum: PaxType }) pax_type?: PaxType;
  @ApiPropertyOptional() nationality?: string;
  @ApiPropertyOptional() passport?: string;
  @ApiPropertyOptional({ type: String, format: 'date' }) date_of_birth?: Date;
  @ApiPropertyOptional({ enum: Gender }) gender?: Gender;
  @ApiPropertyOptional({ type: String, format: 'date' }) date_of_expiry?: Date;
  @ApiPropertyOptional() comment?: string;
  @ApiPropertyOptional() file_path?: string;
  @ApiProperty() created_by: number;
  @ApiProperty({ description: 'Sum of non-deleted payments for this member.' })
  payment: number;
  @ApiProperty() is_deleted: boolean;
  @ApiPropertyOptional() deleted_by?: number;
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
}
