import { OmitType, PartialType } from '@nestjs/swagger';
import { AddMemberDto } from './add-member.dto';

export class UpdateMemberDto extends PartialType(
  OmitType(AddMemberDto, ['payment', 'currency_id'] as const),
) {}
