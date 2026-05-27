import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { UserType } from '@prisma/client';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';

@Controller('customer/me')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserType.CUSTOMER)
export class CustomerMeController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getMyProfile(@GetUser('customerId') customerId: string) {
    if (!customerId) {
      throw new ForbiddenException('User is not associated with a customer account');
    }
    return this.customerService.findOne(customerId);
  }

  @Patch()
  @HttpCode(HttpStatus.OK)
  async updateMyProfile(
    @GetUser('customerId') customerId: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    if (!customerId) {
      throw new ForbiddenException('User is not associated with a customer account');
    }
    return this.customerService.update(customerId, dto);
  }

  @Post('contact')
  @HttpCode(HttpStatus.CREATED)
  async addMyContact(
    @GetUser('customerId') customerId: string,
    @Body() dto: CreateContactDto,
  ) {
    if (!customerId) {
      throw new ForbiddenException('User is not associated with a customer account');
    }
    return this.customerService.addContact(customerId, dto);
  }

  @Patch('contact/:contactId')
  @HttpCode(HttpStatus.OK)
  async updateMyContact(
    @GetUser('customerId') customerId: string,
    @Param('contactId') contactId: string,
    @Body() dto: UpdateContactDto,
  ) {
    if (!customerId) {
      throw new ForbiddenException('User is not associated with a customer account');
    }
    return this.customerService.updateContact(customerId, contactId, dto);
  }

  @Delete('contact/:contactId')
  @HttpCode(HttpStatus.OK)
  async removeMyContact(
    @GetUser('customerId') customerId: string,
    @Param('contactId') contactId: string,
  ) {
    if (!customerId) {
      throw new ForbiddenException('User is not associated with a customer account');
    }
    return this.customerService.removeContact(customerId, contactId);
  }
}
