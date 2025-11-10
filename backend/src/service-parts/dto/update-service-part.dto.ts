import { PartialType } from '@nestjs/mapped-types';
import { CreateServicePartDto } from './create-service-part.dto';

export class UpdateServicePartDto extends PartialType(CreateServicePartDto) {}
