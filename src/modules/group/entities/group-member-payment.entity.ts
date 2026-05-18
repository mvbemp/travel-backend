import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GroupMemberPaymentEntity {
  @ApiProperty() id: number;
  @ApiProperty() group_member_id: number;
  @ApiProperty() payment: number;
  @ApiProperty() original_payment: number;
  @ApiPropertyOptional() currency_id?: number;
  @ApiProperty() currency_rate: number;
  @ApiPropertyOptional() main_currency_id?: number;
  @ApiProperty() created_by: number;
  @ApiPropertyOptional() deleted_by?: number;
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
  @ApiPropertyOptional({ type: String, format: 'date-time' }) deleted_at?: Date;
}
