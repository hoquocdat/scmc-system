import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PosService } from './pos.service';
import { CreatePosSessionDto } from './dto/create-pos-session.dto';
import { ClosePosSessionDto } from './dto/close-pos-session.dto';
import { PosSessionQueryDto } from './dto/pos-session-query.dto';
import { CreatePosTransactionDto } from './dto/create-pos-transaction.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('pos')
@ApiBearerAuth()
@Controller('pos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PosController {
  constructor(private readonly posService: PosService) {}

  @Post('sessions')
  @Roles('sales', 'manager')
  @ApiOperation({ summary: 'Create a new POS session' })
  create(@Body() createPosSessionDto: CreatePosSessionDto) {
    return this.posService.createSession(createPosSessionDto);
  }

  @Get('sessions')
  @Roles('sales', 'manager', 'finance')
  @ApiOperation({ summary: 'Get all POS sessions' })
  findAll(@Query() query: PosSessionQueryDto) {
    return this.posService.findAll(query);
  }

  @Get('sessions/:id')
  @Roles('sales', 'manager', 'finance')
  @ApiOperation({ summary: 'Get a single POS session' })
  findOne(@Param('id') id: string) {
    return this.posService.findOne(id);
  }

  @Get('sessions/current/:userId/:locationId')
  @Roles('sales', 'manager')
  @ApiOperation({ summary: 'Get current open session for user at location' })
  getCurrentSession(
    @Param('userId') userId: string,
    @Param('locationId') locationId: string,
  ) {
    return this.posService.getCurrentSession(userId, locationId);
  }

  @Patch('sessions/:id/close')
  @Roles('sales', 'manager')
  @ApiOperation({ summary: 'Close a POS session' })
  closeSession(
    @Param('id') id: string,
    @Body() closePosSessionDto: ClosePosSessionDto,
  ) {
    return this.posService.closeSession(id, closePosSessionDto);
  }

  @Post('transactions')
  @Roles('sales', 'manager')
  @ApiOperation({ summary: 'Add a transaction to a POS session' })
  addTransaction(@Body() createPosTransactionDto: CreatePosTransactionDto) {
    return this.posService.addTransaction(createPosTransactionDto);
  }

  @Get('sessions/:id/stats')
  @Roles('sales', 'manager', 'finance')
  @ApiOperation({ summary: 'Get session statistics' })
  getSessionStats(@Param('id') id: string) {
    return this.posService.getSessionStats(id);
  }
}
