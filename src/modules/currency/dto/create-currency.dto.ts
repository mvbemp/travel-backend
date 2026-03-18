import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

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
}
