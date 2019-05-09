import { Injectable } from '@nestjs/common';

export interface RootResponse {
  name: string;
  version: string;
  environment?: string;
}

@Injectable()
export class AppService {
  root(): RootResponse {
    const { name, version } = require(process.cwd() + '/package.json');
    const environment = process.env.NODE_ENV || '(development)';
    return {
      name,
      version,
      environment,
    };
  }
}
