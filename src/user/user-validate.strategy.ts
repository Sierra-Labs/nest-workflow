import { ValidateStrategy, JwtPayload, User } from '@sierralabs/nest-identity';
import { UserService } from './user.service';
import { Inject } from '@nestjs/common';

export class UserValidateStrategy extends ValidateStrategy
  implements ValidateStrategy {
  constructor(@Inject(UserService) private readonly userService: UserService) {
    super();
  }

  async validate(payload: JwtPayload): Promise<User> {
    return this.userService.findById(payload.userId);
  }
}
