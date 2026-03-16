import { Controller, Post, Body } from '@nestjs/common';
import { PlatformService } from './platform.service';

@Controller('platform')
export class PlatformController {
  constructor(private platformService: PlatformService) {}

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    return this.platformService.login(body.email, body.password);
  }
}
