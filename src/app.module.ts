import { Module, ValidationPipe } from '@nestjs/common';
import { PrismaModule } from './core/prisma/prisma.module';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { GroupModule } from './modules/group/group.module';
import { APP_PIPE } from '@nestjs/core';

@Module({
  imports: [PrismaModule, UserModule, AuthModule, GroupModule],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: false,
        transform: true,
        transformOptions: {
          exposeUnsetFields: false,
          excludeExtraneousValues: false,
          enableImplicitConversion: true,
        },
      }),
    },
  ],
})
export class AppModule {}
