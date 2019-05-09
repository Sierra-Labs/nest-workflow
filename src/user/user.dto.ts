import { ApiModelProperty } from '@nestjs/swagger';
import { RegisterDto as BaseRegisterDto } from '@sierralabs/nest-identity';

export class RegisterDto extends BaseRegisterDto {
  @ApiModelProperty()
  organizationId: number;
  @ApiModelProperty()
  token: string; // for organization invite to auto validate email
}
