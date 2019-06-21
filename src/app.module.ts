import * as convict from 'convict';
import * as dotenv from 'dotenv';
import * as path from 'path';

import { MailerModule } from '@nest-modules/mailer';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule, MailerConfigService } from '@sierralabs/nest-identity';
import {
  ConfigModule,
  ConfigService,
  PostgresNamingStrategy,
} from '@sierralabs/nest-utils';

import * as configSchema from '../config/config-schema.json';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FileModule } from './file/file.module';
import { NodeModule } from './node/node.module';
import { OrganizationModule } from './organization/organization.module';
import { RolesModule } from './roles/roles.module';
import { UserValidateStrategy } from './user/user-validate.strategy';
import { UserModule } from './user/user.module';
import { ViewModule } from './view/view.module';
import { WorkflowModule } from './workflow/workflow.module';

const environment = process.env.NODE_ENV || 'development';
const envFilePath = path.resolve(process.cwd(), `.env.${environment}`);
dotenv.config({ path: envFilePath });
const schema = convict(configSchema).validate();
const configService = new ConfigService(schema);
const config = configService.get('database');
@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: config.type as 'postgres',
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      database: config.database,
      entities: [__dirname + '/entities/**.entity{.ts,.js}'],
      extra: {
        // idleTimeoutMillis: config.poolIdleTimeout || undefined,
        max: config.poolMax,
        ssl: config.ssl,
      },
      // logging: 'all',
      namingStrategy: new PostgresNamingStrategy(),
    }),
    MailerModule.forRootAsync({
      useClass: MailerConfigService,
    }),
    AuthModule.forRoot(UserValidateStrategy, [UserModule]),
    OrganizationModule,
    UserModule,
    RolesModule,
    NodeModule,
    ViewModule,
    WorkflowModule,
    FileModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
