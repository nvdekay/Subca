import { Controller, Get } from '@nestjs/common';
import type { HomeDto } from '@subca/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { HomeService } from './home.service.js';

@Controller('home')
export class HomeController {
  constructor(private readonly home: HomeService) {}

  @Get()
  get(@CurrentUser() user: AuthUser): Promise<HomeDto> {
    return this.home.getHome(user.id);
  }
}
