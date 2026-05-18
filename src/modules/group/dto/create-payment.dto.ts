import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNumber, IsOptional, IsPositive, Min } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({
    example: 100,
    description: 'Amount the user actually entered (in the chosen currency)',
  })
  @IsNumber()
  @Min(0)
  payment: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Currency id; defaults to the main currency when omitted',
  })
  @IsInt()
  @IsPositive()
  @IsOptional()
  currency_id?: number;
}
