import { Controller, Get } from '@nestjs/common';
import { ApiUseTags } from '@nestjs/swagger';

import { AppService, RootResponse } from './app.service';

@ApiUseTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  root(): RootResponse {
    return this.appService.root();
  }
}
