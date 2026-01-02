import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AttendanceService } from './attendance.service';
import {
  ImportAttendanceDto,
  ManualAttendanceDto,
  UpdateAttendanceDto,
  AttendanceRecordQueryDto,
} from './dto/import-attendance.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { GetCurrentUser } from '../auth/current-user.decorator';
import type { CurrentUser } from '../auth/current-user.decorator';

@ApiTags('attendance')
@ApiBearerAuth()
@Controller('attendance')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Post('import')
  @Roles('manager', 'finance')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Import attendance from Excel file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        payroll_period_id: {
          type: 'string',
          format: 'uuid',
        },
        clear_existing: {
          type: 'boolean',
          default: true,
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Import completed' })
  @ApiResponse({ status: 400, description: 'Invalid file or period' })
  async importAttendance(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({
            fileType:
              /application\/vnd\.(openxmlformats-officedocument\.spreadsheetml\.sheet|ms-excel)/,
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() dto: ImportAttendanceDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.attendanceService.importAttendance(
      dto.payroll_period_id,
      file,
      user.id,
      dto.clear_existing !== false,
    );
  }

  @Get('import-logs')
  @Roles('manager', 'finance')
  @ApiOperation({ summary: 'Get import logs for a period' })
  @ApiResponse({ status: 200, description: 'List of import logs' })
  async getImportLogs(@Query('period_id') periodId: string) {
    return this.attendanceService.getImportLogs(periodId);
  }

  @Get('import-logs/:id')
  @Roles('manager', 'finance')
  @ApiOperation({ summary: 'Get import log details' })
  @ApiResponse({ status: 200, description: 'Import log details' })
  @ApiResponse({ status: 404, description: 'Import log not found' })
  async getImportLog(@Param('id') id: string) {
    return this.attendanceService.getImportLog(id);
  }

  @Get('records')
  @Roles('manager', 'finance')
  @ApiOperation({ summary: 'Get attendance records' })
  @ApiResponse({ status: 200, description: 'List of attendance records' })
  async getRecords(@Query() query: AttendanceRecordQueryDto) {
    return this.attendanceService.getRecords(query);
  }

  @Get('records/employee/:employeeId')
  @ApiOperation({ summary: 'Get attendance records for an employee' })
  @ApiResponse({ status: 200, description: 'Employee attendance records' })
  async getEmployeeRecords(
    @Param('employeeId') employeeId: string,
    @Query('period_id') periodId?: string,
    @GetCurrentUser() user?: CurrentUser,
  ) {
    // TODO: Add permission check - employees can only view their own
    return this.attendanceService.getEmployeeRecords(employeeId, periodId);
  }

  @Get('summary/:periodId/:employeeId')
  @ApiOperation({ summary: 'Get attendance summary for an employee in a period' })
  @ApiResponse({ status: 200, description: 'Attendance summary' })
  async getAttendanceSummary(
    @Param('periodId') periodId: string,
    @Param('employeeId') employeeId: string,
  ) {
    return this.attendanceService.getAttendanceSummary(periodId, employeeId);
  }

  @Post('records/manual')
  @Roles('manager', 'finance')
  @ApiOperation({ summary: 'Create manual attendance record' })
  @ApiResponse({ status: 201, description: 'Attendance record created' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  async createManual(
    @Body() dto: ManualAttendanceDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.attendanceService.createManual(dto, user.id);
  }

  @Patch('records/:id')
  @Roles('manager', 'finance')
  @ApiOperation({ summary: 'Update attendance record' })
  @ApiResponse({ status: 200, description: 'Attendance record updated' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  async updateRecord(
    @Param('id') id: string,
    @Body() dto: UpdateAttendanceDto,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.attendanceService.update(id, dto, user.id);
  }

  @Delete('records/:id')
  @Roles('manager', 'finance')
  @ApiOperation({ summary: 'Delete attendance record' })
  @ApiResponse({ status: 200, description: 'Attendance record deleted' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  async deleteRecord(
    @Param('id') id: string,
    @GetCurrentUser() user: CurrentUser,
  ) {
    return this.attendanceService.remove(id, user.id);
  }
}
