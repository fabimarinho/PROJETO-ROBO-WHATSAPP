import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { Public } from '../../shared/decorators/public.decorator';
import { AuthUser } from '../../shared/auth/auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  login(
    @Body() body: { email: string; password: string }
  ): Promise<{ accessToken: string; refreshToken: string; user: AuthUser }> {
    return this.authService.login(body.email, body.password);
  }

  @Public()
  @Post('refresh')
  refresh(@Body() body: { refreshToken: string }): Promise<{ accessToken: string; refreshToken: string; user: AuthUser }> {
    return this.authService.refresh(body.refreshToken);
  }

  @Get('me')
  me(@CurrentUser() user: AuthUser): Promise<AuthUser> {
    return this.authService.getUserOrThrow(user.userId);
  }
}
