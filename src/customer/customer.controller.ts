import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { ApproveCustomerDto } from './dto/approve-customer.dto';
import { RejectCustomerDto } from './dto/reject-customer.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserType } from '@prisma/client';

@Controller('customer')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: QueryCustomerDto) {
    return this.customerService.findAll(query);
  }

  @Get(':id')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string) {
    return this.customerService.findOne(id);
  }

  @Patch(':id/approve')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param('id') id: string,
    @Body() dto: ApproveCustomerDto,
    @GetUser('id') adminId: string,
  ) {
    return this.customerService.approve(id, dto, adminId);
  }

  @Patch(':id/reject')
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.OK)
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectCustomerDto,
    @GetUser('id') adminId: string,
  ) {
    return this.customerService.reject(id, dto, adminId);
  }
}

