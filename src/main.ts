import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());
  app.use(cookieParser());

  // Tum DTO'lar otomatik dogrulanir; tanimsiz alanlar istekten temizlenir
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Media Library API')
    .setDescription(
      'JWT kimlik dogrulama ve kaynak bazli yetkilendirme iceren medya yonetim servisi',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'access-token',
    )
    .addCookieAuth('access_token', { type: 'apiKey', in: 'cookie' }, 'cookie-auth')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true }, //swagger sayfasinda login olduktan sonra tokeni hatirla
  });

  const port = config.get<number>('port') ?? 3000;
  await app.listen(port);

  Logger.log(`API hazir: http://localhost:${port}`, 'Bootstrap');
  Logger.log(`Swagger:   http://localhost:${port}/docs`, 'Bootstrap');
}

void bootstrap();
