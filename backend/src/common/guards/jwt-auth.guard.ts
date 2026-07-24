import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Delegates to the 'jwt' Passport strategy registered by Module 02 (Authentication).
 * Validates the access token and attaches the authenticated user to `request.user`.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
