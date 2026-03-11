import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { PassportType } from 'generated/prisma/enums';

export class AddMemberDto {
  @ApiProperty({ example: 'Ali Karimov' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'AA1234567' })
  @IsString()
  @IsOptional()
  passport?: string;

  @ApiPropertyOptional({ enum: PassportType, example: PassportType.green_passport })
  @IsEnum(PassportType)
  @IsOptional()
  passport_type?: PassportType;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  payment?: number = 0;
}
