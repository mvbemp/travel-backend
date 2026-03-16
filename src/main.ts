import 'dotenv/config'
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const corsOrigins = process.env.CORS_ORIGINS?.split(',') ?? [];
  app.enableCors({ origin: corsOrigins });

  if (process.env.SWAGGER_ENABLED === 'true') {
    const config = new DocumentBuilder()
      .setTitle(process.env.APP_NAME || 'Travel API')
      .setVersion(process.env.APP_VERSION || '1.0.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(process.env.APP_PORT || 3000, () => {
    console.log(`Server ready at http://localhost:${process.env.APP_PORT}`);
    console.log(`Swagger docs at http://localhost:${process.env.APP_PORT}/docs`);
  });
}
bootstrap();
