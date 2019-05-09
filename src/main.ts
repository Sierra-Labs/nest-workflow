import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { ConfigService } from '@sierralabs/nest-utils';

async function bootstrap() {
  const configService = new ConfigService();
  const port = configService.get('http.port') || 3000;
  const apiConfig = configService.get('api');
  // allow timezone override if specified in config
  if (apiConfig.timezone) {
    process.env.TZ = apiConfig.timezone;
  }
  const isExplorer = apiConfig.explorer;
  const explorerPath = apiConfig.explorerPath || 'api';
  const basePath = apiConfig.basePath || '';

  const packageInfo = require(process.cwd() + '/package.json');
  const environment = process.env.NODE_ENV || 'development';
  const logger = new Logger('Main');
  logger.log(`Environment  : ${environment}`);
  logger.log(`Version      : ${packageInfo.version}`);
  logger.log(`Timezone     : ${process.env.TZ}`);

  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: '*' });
  app.setGlobalPrefix(basePath);

  if (isExplorer) {
    const options = new DocumentBuilder()
      .setBasePath(basePath)
      .setTitle(packageInfo.name)
      .setDescription(packageInfo.description)
      .setVersion(packageInfo.version)
      .addBearerAuth()
      // .addTag('tag')
      .build();
    const document = SwaggerModule.createDocument(app, options);
    SwaggerModule.setup(explorerPath, app, document);
  }

  await app.listen(port);
}
bootstrap();
