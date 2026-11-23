import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsUUID, Max, Min } from 'class-validator';

/**
 * A user with pos:approve (authenticated with their own token on the POS
 * device) approves a discount for one specific cart.
 */
export class DiscountApprovalDto {
  @ApiProperty({ description: 'client_request_id of the cart being approved' })
  @IsUUID()
  client_request_id: string;

  @ApiProperty({
    description: 'Discount percent being approved (of the order subtotal)',
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  discount_percent: number;
}
