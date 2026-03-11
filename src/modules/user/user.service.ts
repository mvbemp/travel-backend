import { Injectable } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/core/prisma/prisma.service';

@Injectable()
export class UserService {
  constructor (
    private readonly prisma: PrismaService,
  ) {}

  async create(createUserDto: CreateUserDto) {
    const checkExist = await this.prisma.user.findUnique({
      where: {
        email: createUserDto.email,
      },
    });

    if (checkExist) {
      return 'User with this email already exists';
    }
    
    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        full_name: createUserDto.full_name,
        password: createUserDto.password,
        type: createUserDto.type,
        phone_number: createUserDto.phone_number,

      },
    });

    return user;
  }

  async findAll() {
    return await this.prisma.user.findMany();
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
