import { ApiProperty } from '@nestjs/swagger';
import { UserType } from 'generated/prisma/enums';

export class UserShortEntity {
  @ApiProperty() id: number;
  @ApiProperty() email: string;
  @ApiProperty() full_name: string;
  @ApiProperty() phone_number: string;
  @ApiProperty({ enum: UserType }) type: UserType;
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
}
