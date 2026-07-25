import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { VendorsService } from './vendors.service';

// 4.8 — static reference endpoint, not wedding-scoped.
@ApiTags('Vendors')
@ApiBearerAuth()
@Controller('vendors')
@UseGuards(JwtAuthGuard)
export class VendorCategoriesController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get('categories')
  listCategories() {
    return this.vendorsService.listCategories();
  }
}
