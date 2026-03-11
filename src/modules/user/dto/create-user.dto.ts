import { Transform } from "class-transformer";
import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from "class-validator";
import { UserType } from "generated/prisma/enums";
import * as bcrypt from 'bcrypt';

export class CreateUserDto {

    @IsEmail()
    @IsString()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    full_name: string;
    
    @IsString()
    @IsNotEmpty()
    @MinLength(5)
    @Transform(({ value }) => {
        value = bcrypt.hashSync(value, 12);
        return value;
    })
    
    password: string;

    @IsEnum(UserType)
    @IsNotEmpty()
    type: UserType;

    @IsString()
    @MinLength(10)
    @IsNotEmpty()
    phone_number: string;
}
