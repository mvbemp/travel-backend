import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from "class-validator";
import { UserType } from "generated/prisma/enums";
import * as bcrypt from 'bcrypt';

export class CreateUserDto {

    @ApiProperty({ example: 'user@example.com' })
    @IsEmail()
    @IsString()
    @IsNotEmpty()
    email: string;

    @ApiProperty({ example: 'John Doe' })
    @IsString()
    @IsNotEmpty()
    full_name: string;

    @ApiProperty({ example: 'secret123', minLength: 5 })
    @IsString()
    @IsNotEmpty()
    @MinLength(5)
    @Transform(({ value }) => {
        value = bcrypt.hashSync(value, 12);
        return value;
    })
    password: string;

    @ApiProperty({ enum: UserType, example: UserType.user })
    @IsEnum(UserType)
    @IsNotEmpty()
    type: UserType;

    @ApiProperty({ example: '+998901234567', minLength: 10 })
    @IsString()
    @MinLength(10)
    @IsNotEmpty()
    phone_number: string;
}
