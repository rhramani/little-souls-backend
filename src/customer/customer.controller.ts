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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import { QueryCustomerDto } from './dto/query-customer.dto';
import { ApproveCustomerDto } from './dto/approve-customer.dto';
import { RejectCustomerDto } from './dto/reject-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import { SetOpeningBalanceDto } from './dto/set-opening-balance.dto';
import { ProvisionContactLoginDto } from './dto/provision-contact-login.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserType } from '@prisma/client';

@Controller('customer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserType.SUPER_ADMIN, UserType.STAFF)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async findAll(@Query() query: QueryCustomerDto) {
    return this.customerService.findAll(query);
  }

  @Post()
  @Roles(UserType.SUPER_ADMIN, UserType.STAFF)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateCustomerDto, @GetUser('id') adminId: string) {
    return this.customerService.create(dto, adminId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async findOne(@Param('id') id: string) {
    return this.customerService.findOne(id);
  }

  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customerService.update(id, dto);
  }

  @Patch(':id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param('id') id: string,
    @Body() dto: ApproveCustomerDto,
    @GetUser('id') adminId: string,
  ) {
    return this.customerService.approve(id, dto, adminId);
  }

  @Patch(':id/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectCustomerDto,
    @GetUser('id') adminId: string,
  ) {
    return this.customerService.reject(id, dto, adminId);
  }

  @Patch(':id/deactivate')
  @HttpCode(HttpStatus.OK)
  async deactivate(@Param('id') id: string) {
    return this.customerService.deactivate(id);
  }

  @Patch(':id/activate')
  @HttpCode(HttpStatus.OK)
  async activate(@Param('id') id: string) {
    return this.customerService.activate(id);
  }

  @Delete(':id')
  @Roles(UserType.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.customerService.remove(id);
  }

  @Post(':id/opening-balance')
  @Roles(UserType.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async setOpeningBalance(
    @Param('id') id: string,
    @Body() dto: SetOpeningBalanceDto,
    @GetUser('id') userId: string,
  ) {
    return this.customerService.setOpeningBalance(id, dto, userId);
  }

  // =============== CONTACT PERSON ENDPOINTS ===============

  @Get(':id/contact')
  @HttpCode(HttpStatus.OK)
  async getContacts(@Param('id') id: string) {
    return this.customerService.getContacts(id);
  }

  @Post(':id/contact')
  @HttpCode(HttpStatus.CREATED)
  async addContact(@Param('id') id: string, @Body() dto: CreateContactDto) {
    return this.customerService.addContact(id, dto);
  }

  @Patch(':id/contact/:contactId')
  @HttpCode(HttpStatus.OK)
  async updateContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.customerService.updateContact(id, contactId, dto);
  }

  @Delete(':id/contact/:contactId')
  @Roles(UserType.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async removeContact(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
  ) {
    return this.customerService.removeContact(id, contactId);
  }

  @Post(':id/contact/:contactId/provision-login')
  @HttpCode(HttpStatus.CREATED)
  async provisionContactLogin(
    @Param('id') id: string,
    @Param('contactId') contactId: string,
    @Body() dto: ProvisionContactLoginDto,
  ) {
    return this.customerService.provisionContactLogin(id, contactId, dto);
  }
}
