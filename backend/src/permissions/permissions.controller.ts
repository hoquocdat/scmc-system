import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PoliciesGuard } from '../casl/policies.guard';
import { CheckPolicies } from '../casl/check-policies.decorator';
import { Action } from '../casl/casl-ability.factory';

@ApiTags('permissions')
@ApiBearerAuth()
@Controller('permissions')
@UseGuards(JwtAuthGuard, PoliciesGuard)
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  // ============ PERMISSIONS ENDPOINTS ============

  @Get()
  @CheckPolicies({ action: Action.Read, subject: 'permissions' })
  @ApiOperation({ summary: 'Get all permissions' })
  @ApiResponse({ status: 200, description: 'List of all permissions' })
  getAllPermissions() {
    return this.permissionsService.getAllPermissions();
  }

  @Get('resource/:resource')
  @CheckPolicies({ action: Action.Read, subject: 'permissions' })
  @ApiOperation({ summary: 'Get permissions by resource' })
  @ApiResponse({ status: 200, description: 'List of permissions for resource' })
  getPermissionsByResource(@Param('resource') resource: string) {
    return this.permissionsService.getPermissionsByResource(resource);
  }

  @Get(':id')
  @CheckPolicies({ action: Action.Read, subject: 'permissions' })
  @ApiOperation({ summary: 'Get permission by ID' })
  @ApiResponse({ status: 200, description: 'Permission details' })
  @ApiResponse({ status: 404, description: 'Permission not found' })
  getPermissionById(@Param('id') id: string) {
    return this.permissionsService.getPermissionById(id);
  }

  // ============ ROLES ENDPOINTS ============

  @Get('roles/all')
  @CheckPolicies({ action: Action.Read, subject: 'roles' })
  @ApiOperation({ summary: 'Get all roles' })
  @ApiResponse({ status: 200, description: 'List of all roles with permissions' })
  getAllRoles() {
    return this.permissionsService.getAllRoles();
  }

  @Get('roles/:id')
  @CheckPolicies({ action: Action.Read, subject: 'roles' })
  @ApiOperation({ summary: 'Get role by ID' })
  @ApiResponse({ status: 200, description: 'Role details with permissions and users' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  getRoleById(@Param('id') id: string) {
    return this.permissionsService.getRoleById(id);
  }

  @Post('roles')
  @CheckPolicies({ action: Action.Create, subject: 'roles' })
  @ApiOperation({ summary: 'Create a new role' })
  @ApiResponse({ status: 201, description: 'Role created successfully' })
  @ApiResponse({ status: 409, description: 'Role with this name already exists' })
  createRole(@Body() createRoleDto: CreateRoleDto) {
    return this.permissionsService.createRole(createRoleDto);
  }

  @Put('roles/:id')
  @CheckPolicies({ action: Action.Update, subject: 'roles' })
  @ApiOperation({ summary: 'Update a role' })
  @ApiResponse({ status: 200, description: 'Role updated successfully' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  updateRole(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.permissionsService.updateRole(id, updateRoleDto);
  }

  @Delete('roles/:id')
  @CheckPolicies({ action: Action.Delete, subject: 'roles' })
  @ApiOperation({ summary: 'Delete a role' })
  @ApiResponse({ status: 200, description: 'Role deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete system roles' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  deleteRole(@Param('id') id: string) {
    return this.permissionsService.deleteRole(id);
  }

  // ============ ROLE PERMISSIONS ENDPOINTS ============

  @Post('roles/:roleId/permissions')
  @CheckPolicies({ action: Action.Grant, subject: 'permissions' })
  @ApiOperation({ summary: 'Assign permissions to a role' })
  @ApiResponse({ status: 200, description: 'Permissions assigned successfully' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async assignPermissionsToRole(
    @Param('roleId') roleId: string,
    @Body() body: { permissionIds: string[] },
  ) {
    await this.permissionsService.assignPermissionsToRole(
      roleId,
      body.permissionIds,
    );
    return { message: 'Permissions assigned successfully' };
  }

  @Delete('roles/:roleId/permissions/:permissionId')
  @CheckPolicies({ action: Action.Revoke, subject: 'permissions' })
  @ApiOperation({ summary: 'Remove a permission from a role' })
  @ApiResponse({ status: 200, description: 'Permission removed successfully' })
  @ApiResponse({ status: 404, description: 'Association not found' })
  async removePermissionFromRole(
    @Param('roleId') roleId: string,
    @Param('permissionId') permissionId: string,
  ) {
    await this.permissionsService.removePermissionFromRole(roleId, permissionId);
    return { message: 'Permission removed successfully' };
  }

  // ============ USER ROLES ENDPOINTS ============

  @Get('users/all-with-roles')
  @CheckPolicies({ action: Action.Read, subject: 'users' })
  @ApiOperation({ summary: 'Get all users with their roles' })
  @ApiResponse({ status: 200, description: 'List of users with roles' })
  getAllUsersWithRoles() {
    return this.permissionsService.getAllUsersWithRoles();
  }

  @Get('users/:userId/roles')
  @CheckPolicies({ action: Action.Read, subject: 'roles' })
  @ApiOperation({ summary: 'Get roles for a user' })
  @ApiResponse({ status: 200, description: 'User roles' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getUserRoles(@Param('userId') userId: string) {
    return this.permissionsService.getUserRoles(userId);
  }

  @Post('users/assign-roles')
  @CheckPolicies({ action: Action.Assign, subject: 'roles' })
  @ApiOperation({ summary: 'Assign roles to a user' })
  @ApiResponse({ status: 200, description: 'Roles assigned successfully' })
  @ApiResponse({ status: 404, description: 'User or role not found' })
  assignRolesToUser(@Body() assignRoleDto: AssignRoleDto, @Request() req: any) {
    return this.permissionsService.assignRolesToUser(
      assignRoleDto,
      req.user.id,
    );
  }

  @Delete('users/:userId/roles/:roleId')
  @CheckPolicies({ action: Action.Assign, subject: 'roles' })
  @ApiOperation({ summary: 'Remove a role from a user' })
  @ApiResponse({ status: 200, description: 'Role removed successfully' })
  @ApiResponse({ status: 404, description: 'Association not found' })
  async removeRoleFromUser(
    @Param('userId') userId: string,
    @Param('roleId') roleId: string,
  ) {
    await this.permissionsService.removeRoleFromUser(userId, roleId);
    return { message: 'Role removed successfully' };
  }

  // ============ USER PERMISSIONS ENDPOINTS ============

  @Get('users/:userId/permissions')
  @CheckPolicies({ action: Action.Read, subject: 'permissions' })
  @ApiOperation({ summary: 'Get user-specific permissions' })
  @ApiResponse({ status: 200, description: 'User-specific permissions (ABAC)' })
  getUserPermissions(@Param('userId') userId: string) {
    return this.permissionsService.getUserPermissions(userId);
  }

  @Post('users/:userId/permissions')
  @CheckPolicies({ action: Action.Grant, subject: 'permissions' })
  @ApiOperation({ summary: 'Assign specific permissions to a user' })
  @ApiResponse({ status: 200, description: 'Permissions assigned successfully' })
  async assignPermissionsToUser(
    @Param('userId') userId: string,
    @Body() body: { permissionIds: string[]; granted?: boolean },
    @Request() req: any,
  ) {
    await this.permissionsService.assignPermissionsToUser(
      userId,
      body.permissionIds,
      body.granted !== undefined ? body.granted : true,
      req.user.id,
    );
    return { message: 'User permissions assigned successfully' };
  }

  @Delete('users/:userId/permissions/:permissionId')
  @CheckPolicies({ action: Action.Revoke, subject: 'permissions' })
  @ApiOperation({ summary: 'Remove a user-specific permission' })
  @ApiResponse({ status: 200, description: 'Permission removed successfully' })
  async removePermissionFromUser(
    @Param('userId') userId: string,
    @Param('permissionId') permissionId: string,
  ) {
    await this.permissionsService.removePermissionFromUser(userId, permissionId);
    return { message: 'User permission removed successfully' };
  }

  // ============ AUDIT LOG ENDPOINTS ============

  @Get('audit/logs')
  @CheckPolicies({ action: Action.Read, subject: 'permissions' })
  @ApiOperation({ summary: 'Get audit logs' })
  @ApiResponse({ status: 200, description: 'List of audit logs' })
  getAuditLogs(
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.permissionsService.getAuditLogs(
      limit ? Number(limit) : 100,
      offset ? Number(offset) : 0,
    );
  }

  @Get('audit/users/:userId')
  @CheckPolicies({ action: Action.Read, subject: 'permissions' })
  @ApiOperation({ summary: 'Get audit logs for a specific user' })
  @ApiResponse({ status: 200, description: 'User audit logs' })
  getAuditLogsForUser(
    @Param('userId') userId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.permissionsService.getAuditLogsForUser(
      userId,
      limit ? Number(limit) : 100,
      offset ? Number(offset) : 0,
    );
  }
}
