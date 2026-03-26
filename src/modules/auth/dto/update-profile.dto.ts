import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import * as bcrypt from 'bcrypt';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'new@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'newpassword', minLength: 5 })
  @IsOptional()
  @IsString()
  @MinLength(5)
  @Transform(({ value }) => (value ? bcrypt.hashSync(value, 12) : value))
  password?: string;
}
