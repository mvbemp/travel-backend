import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateGroupDto {
  @ApiProperty({ example: 'Trip to Paris' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Summer vacation group' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: '2026-06-15' })
  @IsDateString()
  @IsNotEmpty()
  date: string;

}
