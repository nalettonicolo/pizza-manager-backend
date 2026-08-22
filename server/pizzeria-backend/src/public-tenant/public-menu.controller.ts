import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PublicMenuIngredientsDto } from './dto/public-menu-ingredients.dto';
import { PublicMenuService } from './public-menu.service';

@ApiTags('public')
@Controller('public/menu')
@Throttle({ default: { limit: 60, ttl: 60_000 } })
export class PublicMenuController {
  constructor(private readonly menu: PublicMenuService) {}

  @Get('for-tenant/:tenantId')
  @ApiOperation({ summary: 'Menu vetrina (RPC get_public_menu_for_tenant)' })
  forTenant(@Param('tenantId') tenantId: string) {
    return this.menu.menuForTenant(tenantId);
  }

  @Get('for-domain')
  @ApiOperation({
    summary: 'Menu vetrina per hostname (RPC get_public_menu_for_domain)',
  })
  forDomain(@Query('host') host: string) {
    return this.menu.menuForDomain(host);
  }

  @Get('categories/:tenantId')
  @ApiOperation({
    summary: 'Categorie catalogo vetrina (get_public_categories_for_tenant)',
  })
  categories(@Param('tenantId') tenantId: string) {
    return this.menu.categoriesForTenant(tenantId);
  }

  @Post('ingredient-names')
  @ApiOperation({
    summary: 'Nomi ingredienti per prodotti (get_public_menu_ingredient_names)',
  })
  ingredientNames(@Body() body: PublicMenuIngredientsDto) {
    return this.menu.ingredientNames(body.tenantId, body.productIds);
  }
}
