import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNumber, IsPositive, Min } from 'class-validator';

export class AddGroupExpenseDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  expense_id: number;

  @ApiProperty({ example: 150.0 })
  @IsNumber()
  @Min(0)
  value: number;
}
