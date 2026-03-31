import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString, Min } from 'class-validator';
import { Gender, PaxType } from 'generated/prisma/enums';

export class AddMemberDto {
  @ApiProperty({ example: 'Ali' })
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiProperty({ example: 'Karimov' })
  @IsString()
  @IsNotEmpty()
  last_name: string;

  @ApiPropertyOptional({ enum: PaxType, example: PaxType.A })
  @IsEnum(PaxType)
  @IsOptional()
  pax_type?: PaxType = PaxType.A;

  @ApiPropertyOptional({ example: 'Uzbek' })
  @IsString()
  @IsOptional()
  nationality?: string;

  @ApiPropertyOptional({ example: 'AA1234567' })
  @IsString()
  @IsOptional()
  passport?: string;

  @ApiPropertyOptional({ example: '1990-01-01' })
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  @IsDate()
  @IsOptional()
  date_of_birth?: Date;

  @ApiPropertyOptional({ enum: Gender, example: Gender.male })
  @IsEnum(Gender)
  @IsOptional()
  gender?: Gender;

  @ApiPropertyOptional({ example: '2030-12-31' })
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  @IsDate()
  @IsOptional()
  date_of_expiry?: Date;

  @ApiPropertyOptional({ example: 'VIP passenger' })
  @IsString()
  @IsOptional()
  comment?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @IsPositive()
  @IsOptional()
  currency_id?: number;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  payment?: number = 0;
}
