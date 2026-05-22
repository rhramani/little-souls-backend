import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { WinstonModule, utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as winston from 'winston';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: WinstonModule.createLogger({
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.ms(),
            nestWinstonModuleUtilities.format.nestLike('LittleSouls', {
              colors: true,
              appName: true,
            }),
          ),
        }),
      ],
    }),
  });

  // Log all HTTP requests
  const morganMiddleware = require('morgan');
  app.use(morganMiddleware('dev'));

  // Enable CORS
  app.enableCors({
    origin: true,
    credentials: true,
  });

  // Enable Global Prefix
  app.setGlobalPrefix('api');

  // Enable Global Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(
    `[Little Souls Backend] Running successfully on port ${port} (API Prefix: /api)`,
  );
}
bootstrap();
