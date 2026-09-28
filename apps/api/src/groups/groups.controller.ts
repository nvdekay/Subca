import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import {
  AddGroupMemberSchema,
  CreateGroupSchema,
  JoinGroupSchema,
  SetSplitSchema,
  UpdateGroupMemberSchema,
  UpdateGroupSchema,
  type AddGroupMember,
  type CreateGroup,
  type GroupDetailDto,
  type GroupsOverviewDto,
  type JoinGroup,
  type SetSplit,
  type UpdateGroup,
  type UpdateGroupMember,
} from '@subca/shared';
import type { AuthUser } from '../auth/auth.types.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { uuidParam } from '../common/uuid.pipe.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { GroupPaymentsService } from './group-payments.service.js';
import { GroupsService } from './groups.service.js';

@Controller('groups')
export class GroupsController {
  constructor(
    private readonly groups: GroupsService,
    private readonly payments: GroupPaymentsService,
  ) {}

  @Get()
  overview(@CurrentUser() user: AuthUser): Promise<GroupsOverviewDto> {
    return this.groups.overview(user.id);
  }

  @Post()
  create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(CreateGroupSchema)) body: CreateGroup,
  ): Promise<GroupDetailDto> {
    return this.groups.create(user.id, body);
  }

  /** Vào nhóm bằng mã trong link mời `subca.app/j/<mã>`. */
  @Post('join')
  join(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(JoinGroupSchema)) body: JoinGroup,
  ): Promise<GroupDetailDto> {
    return this.groups.join(user.id, body);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidParam) id: string,
  ): Promise<GroupDetailDto> {
    return this.groups.get(user.id, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(UpdateGroupSchema)) body: UpdateGroup,
  ): Promise<GroupDetailDto> {
    return this.groups.update(user.id, id, body);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  archive(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidParam) id: string,
  ): Promise<void> {
    return this.groups.archive(user.id, id);
  }

  @Put(':id/split')
  setSplit(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(SetSplitSchema)) body: SetSplit,
  ): Promise<GroupDetailDto> {
    return this.groups.setSplit(user.id, id, body);
  }

  @Post(':id/members')
  addMember(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidParam) id: string,
    @Body(new ZodValidationPipe(AddGroupMemberSchema)) body: AddGroupMember,
  ): Promise<GroupDetailDto> {
    return this.groups.addMember(user.id, id, body);
  }

  @Patch(':id/members/:memberId')
  updateMember(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidParam) id: string,
    @Param('memberId', uuidParam) memberId: string,
    @Body(new ZodValidationPipe(UpdateGroupMemberSchema))
    body: UpdateGroupMember,
  ): Promise<GroupDetailDto> {
    return this.groups.updateMember(user.id, id, memberId, body);
  }

  /** Chủ nhóm gỡ thành viên, hoặc thành viên tự rời nhóm. */
  @Delete(':id/members/:memberId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidParam) id: string,
    @Param('memberId', uuidParam) memberId: string,
  ): Promise<void> {
    return this.groups.removeMember(user.id, id, memberId);
  }

  @Post(':id/payments/:paymentId/claim')
  claim(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidParam) id: string,
    @Param('paymentId', uuidParam) paymentId: string,
  ): Promise<GroupDetailDto> {
    return this.payments.claim(user.id, id, paymentId);
  }

  @Post(':id/payments/:paymentId/confirm')
  confirm(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidParam) id: string,
    @Param('paymentId', uuidParam) paymentId: string,
  ): Promise<GroupDetailDto> {
    return this.payments.confirm(user.id, id, paymentId);
  }

  @Post(':id/payments/:paymentId/waive')
  waive(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidParam) id: string,
    @Param('paymentId', uuidParam) paymentId: string,
  ): Promise<GroupDetailDto> {
    return this.payments.waive(user.id, id, paymentId);
  }

  @Post(':id/payments/:paymentId/reopen')
  reopen(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidParam) id: string,
    @Param('paymentId', uuidParam) paymentId: string,
  ): Promise<GroupDetailDto> {
    return this.payments.reopen(user.id, id, paymentId);
  }

  @Post(':id/payments/:paymentId/remind')
  remind(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidParam) id: string,
    @Param('paymentId', uuidParam) paymentId: string,
  ): Promise<GroupDetailDto> {
    return this.payments.remind(user.id, id, paymentId);
  }

  @Post(':id/remind-all')
  remindAll(
    @CurrentUser() user: AuthUser,
    @Param('id', uuidParam) id: string,
  ): Promise<{ reminded: number; skipped: number }> {
    return this.payments.remindAll(user.id, id);
  }
}
