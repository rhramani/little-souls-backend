import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SupportService } from './support.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { QueryTicketDto } from './dto/query-ticket.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserType } from '@prisma/client';

@Controller('support')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupportController {
  constructor(private readonly supportService: SupportService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createTicket(@Body() dto: CreateTicketDto, @GetUser() user: any) {
    return this.supportService.createTicket(dto, user);
  }

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: QueryTicketDto, @GetUser() user: any) {
    return this.supportService.findAll(query, user);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string, @GetUser() user: any) {
    return this.supportService.findOne(id, user);
  }

  @Patch(':id/assign')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async assignTicket(
    @Param('id') id: string,
    @Body('assignedTo') assignedTo: string,
  ) {
    return this.supportService.assignTicket(id, assignedTo);
  }

  @Patch(':id/status')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async transitionStatus(
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.supportService.transitionStatus(id, status);
  }

  @Patch(':id/priority')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async updatePriority(
    @Param('id') id: string,
    @Body('priority') priority: string,
  ) {
    return this.supportService.updatePriority(id, priority);
  }
}
