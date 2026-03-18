import { Module, ValidationPipe } from '@nestjs/common';
import { PrismaModule } from './core/prisma/prisma.module';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { GroupModule } from './modules/group/group.module';
import { CurrencyModule } from './modules/currency/currency.module';
import { ExpenseModule } from './modules/expense/expense.module';
import { APP_PIPE } from '@nestjs/core';
import { AcceptLanguageResolver, I18nJsonLoader, I18nModule, QueryResolver } from 'nestjs-i18n';
import { join } from 'path';

@Module({
  imports: [
    I18nModule.forRootAsync({
      useFactory: () => ({
        fallbackLanguage: 'en',
        loader: I18nJsonLoader,
        loaderOptions: {
          path: join(__dirname, '/locales/'),
          watch: true,
        },        
      }),
      resolvers: [{ use: QueryResolver, options: ['lang'] }, AcceptLanguageResolver],
    }),
    PrismaModule,
    UserModule,
    AuthModule,
    GroupModule,
    CurrencyModule,
    ExpenseModule,
  ],
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
