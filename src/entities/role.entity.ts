import { Entity } from 'typeorm';
import { User } from './user.entity';
import { Role as BaseRole } from '@sierralabs/nest-identity';
import { ReplaceRelationType } from '@sierralabs/nest-utils';

@Entity()
export class Role extends BaseRole {
  @ReplaceRelationType(type => User)
  public users: User[];
}
