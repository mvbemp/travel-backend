import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserType } from 'generated/prisma/enums';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserType[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);    
    
    if (!requiredRoles) return true;

    const { user } = context.switchToHttp().getRequest();
    if (!requiredRoles.includes(user?.type)) {
      throw new ForbiddenException('Access denied');
    }
    return true;
  }
}
