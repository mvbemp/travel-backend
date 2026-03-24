import 'dotenv/config'
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { I18nService } from 'nestjs-i18n';
import { setI18nService } from './common/helpers/translation.helper';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const corsOrigins = process.env.CORS_ORIGINS?.split(',') ?? [];
  app.enableCors({ origin: corsOrigins });

  app.setGlobalPrefix('api')

  if (process.env.ENABLE_SWAGGER === 'true') {
    const config = new DocumentBuilder()
      .setTitle(process.env.APP_NAME || 'Travel API')
      .setVersion(process.env.APP_VERSION || '1.0.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  // Setup i18n service globally
  const i18n = app.get<I18nService<Record<string, unknown>>>(I18nService);
  setI18nService(i18n);

  await app.listen(process.env.APP_PORT || 3000, () => {
    console.log(`Server ready at http://localhost:${process.env.APP_PORT}`);
    console.log(`Swagger docs at http://localhost:${process.env.APP_PORT}/docs`);
  });
}
bootstrap();
