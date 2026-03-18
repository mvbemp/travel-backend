import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsNumber, IsPositive, IsString, Min } from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty({ example: 'Flight ticket' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @IsPositive()
  currency_id: number;

  @ApiProperty({ example: 150.00 })
  @IsNumber()
  @Min(0)
  value: number;
}
