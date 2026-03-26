import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateCurrencyDto {
  @ApiProperty({ example: 'USD' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: '$' })
  @IsString()
  @IsNotEmpty()
  symbol: string;

  @ApiProperty({ example: 'United States' })
  @IsString()
  @IsNotEmpty()
  country: string;

  @ApiProperty({ example: false, required: false })
  @IsBoolean()
  @IsOptional()
  is_main?: boolean;

  @ApiProperty({ example: 1, required: false, description: 'How many units of this currency equal 1 unit of the main currency' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  currency_change?: number;
}
