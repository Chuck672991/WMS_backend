import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { JwtRefreshAuthGuard } from './strategies/jwt-refresh.strategy';
import type { ValidatedRefreshToken } from './strategies/jwt-refresh.strategy';

// Section 2's Security Notes specify 5 req/15min/IP; raised to 20 so normal
// interactive use (repeated login/logout during testing, a family member
// mistyping a password a few times) doesn't get blocked, while still capping
// sustained brute-force attempts.
const AUTH_THROTTLE = { default: { limit: 20, ttl: 900_000 } };

function deviceInfoFrom(req: Request): string | undefined {
  return req.get('user-agent');
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 2.1
  @Throttle(AUTH_THROTTLE)
  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, deviceInfoFrom(req));
  }

  // 2.2
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, deviceInfoFrom(req));
  }

  // 2.3
  @HttpCode(HttpStatus.OK)
  @Post('google')
  googleLogin(@Body() dto: GoogleLoginDto, @Req() req: Request) {
    return this.authService.googleLogin(dto, deviceInfoFrom(req));
  }

  // 2.4
  @Throttle(AUTH_THROTTLE)
  @HttpCode(HttpStatus.OK)
  @Post('forgot-password')
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  // 2.5
  @HttpCode(HttpStatus.OK)
  @Post('reset-password')
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  // 2.6
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtRefreshAuthGuard)
  @Post('refresh')
  refresh(@Req() req: Request) {
    const { sub, tokenId, rawToken } = req.user as ValidatedRefreshToken;
    return this.authService.refreshTokens(
      sub,
      tokenId,
      rawToken,
      deviceInfoFrom(req),
    );
  }

  // 2.7
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(
    @Body() dto: RefreshTokenDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.authService.logout(user.id, dto.refreshToken);
  }

  // 2.8
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  logoutAll(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.logoutAll(user.id);
  }

  // 2.9
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  getSessions(@CurrentUser() user: CurrentUserPayload) {
    return this.authService.getSessions(user.id);
  }
}
