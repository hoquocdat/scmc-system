import { IsString, IsNotEmpty, IsUUID } from 'class-validator';

export class CreateCommentDto {
  @IsUUID()
  @IsNotEmpty()
  service_order_id: string;

  @IsString()
  @IsNotEmpty()
  comment_text: string;
}
