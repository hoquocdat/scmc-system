import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

export interface UserContext {
  id: string;
  email: string;
  role: string;
  full_name: string;
}

@Injectable()
export class UserContextService {
  constructor(private readonly cls: ClsService) {}

  setUser(user: UserContext): void {
    this.cls.set('user', user);
  }

  getUser(): UserContext | null {
    return this.cls.get('user') || null;
  }

  getUserId(): string | null {
    const user = this.getUser();
    return user?.id || null;
  }
}
