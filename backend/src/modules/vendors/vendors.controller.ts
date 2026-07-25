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
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { WeddingRole } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { WeddingAccessGuard } from '../../common/guards/wedding-access.guard';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { QueryVendorDto } from './dto/query-vendor.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { VendorsService } from './vendors.service';

@ApiTags('Vendors')
@ApiBearerAuth()
@Controller('weddings/:weddingId/vendors')
@UseGuards(JwtAuthGuard, WeddingAccessGuard, RolesGuard)
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  // 4.1 — any member
  @Get()
  list(@Param('weddingId') weddingId: string, @Query() query: QueryVendorDto) {
    return this.vendorsService.listVendors(weddingId, query);
  }

  // 4.2 — any member
  @Get(':vendorId')
  getDetail(
    @Param('weddingId') weddingId: string,
    @Param('vendorId') vendorId: string,
  ) {
    return this.vendorsService.getVendorDetail(weddingId, vendorId);
  }

  // 4.3
  @Roles(WeddingRole.OWNER, WeddingRole.CO_OWNER)
  @Post()
  create(
    @Param('weddingId') weddingId: string,
    @Body() dto: CreateVendorDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.vendorsService.createVendor(weddingId, user.id, dto);
  }

  // 4.4
  @Roles(WeddingRole.OWNER, WeddingRole.CO_OWNER)
  @Patch(':vendorId')
  update(
    @Param('weddingId') weddingId: string,
    @Param('vendorId') vendorId: string,
    @Body() dto: UpdateVendorDto,
  ) {
    return this.vendorsService.updateVendor(weddingId, vendorId, dto);
  }

  // 4.5
  @Roles(WeddingRole.OWNER, WeddingRole.CO_OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':vendorId')
  async remove(
    @Param('weddingId') weddingId: string,
    @Param('vendorId') vendorId: string,
  ): Promise<void> {
    await this.vendorsService.deleteVendor(weddingId, vendorId);
  }

  // 4.6
  @Roles(WeddingRole.OWNER, WeddingRole.CO_OWNER)
  @Post(':vendorId/payments')
  recordPayment(
    @Param('weddingId') weddingId: string,
    @Param('vendorId') vendorId: string,
    @Body() dto: RecordPaymentDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.vendorsService.recordPayment(weddingId, vendorId, dto, user.id);
  }

  // 4.7
  @Roles(WeddingRole.OWNER, WeddingRole.CO_OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete(':vendorId/payments/:paymentId')
  async deletePayment(
    @Param('weddingId') weddingId: string,
    @Param('vendorId') vendorId: string,
    @Param('paymentId') paymentId: string,
  ): Promise<void> {
    await this.vendorsService.deletePayment(weddingId, vendorId, paymentId);
  }
}
