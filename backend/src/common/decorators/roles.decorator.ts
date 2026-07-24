import { SetMetadata } from '@nestjs/common';
import { WeddingRole } from '../constants/roles.constant';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: WeddingRole[]) => SetMetadata(ROLES_KEY, roles);
