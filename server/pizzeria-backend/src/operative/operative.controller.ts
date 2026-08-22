import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  ParseUUIDPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { resolveTenantIdForRequest } from '../common/resolve-tenant';
import { BatchProductIdsDto } from './dto/batch-product-ids.dto';
import { CreateOrderDto } from './dto/create-order.dto';
import {
  RigheAggregateDto,
  UpdateOrderPatchDto,
  UpdateOrderStatoDto,
  UpdateOrderTipoPagamentoDto,
} from './dto/patch-order.dto';
import { ReplaceOrderItemsDto } from './dto/replace-order-items.dto';
import { TurniApriDto, TurniChiudiDto } from './dto/turni.dto';
import {
  JwtOperativeUser,
  OperativeWritesService,
} from './operative-writes.service';
import { OperativeService } from './operative.service';

type JwtUser = JwtOperativeUser;

@ApiTags('operative')
@Controller('operative')
export class OperativeController {
  constructor(
    private readonly operative: OperativeService,
    private readonly writes: OperativeWritesService,
  ) {}

  private tenantOf(req: { user: JwtUser }, tenantIdParam?: string) {
    return resolveTenantIdForRequest(req.user, tenantIdParam);
  }

  @Get('ordini')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Ordini tenant da core.ordini',
    description:
      'Filtri opzionali `from` / `to` ISO; allineamento forma client pubblic."Ordine". Super Admin: `tenantId` query = override Sala QA.',
  })
  ordini(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantIdParam?: string,
    @Query('from') fromIso?: string,
    @Query('to') toIso?: string,
    @Query('limit') limitStr?: string,
    @Query('stato') stato?: string,
  ) {
    const tenantId = this.tenantOf(req, tenantIdParam);
    const limit = limitStr ? Number(limitStr) : 50;
    return this.operative.listOrdini(tenantId, {
      fromIso: fromIso || undefined,
      toIso: toIso || undefined,
      limit: Number.isFinite(limit) ? limit : 50,
      stato: stato || undefined,
    });
  }

  @Get('categorie')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Categorie catalogo (core.categorie)' })
  categorie(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantIdParam?: string,
  ) {
    return this.operative.listCategorie(this.tenantOf(req, tenantIdParam));
  }

  @Get('ingredienti')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ingredienti tenant (core.ingredienti)' })
  ingredienti(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantIdParam?: string,
  ) {
    return this.operative.listIngredienti(this.tenantOf(req, tenantIdParam));
  }

  @Get('prodotti')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Prodotti tenant (core.prodotti), opz. categoria' })
  prodotti(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantIdParam?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.operative.listProdotti(
      this.tenantOf(req, tenantIdParam),
      categoryId,
    );
  }

  @Get('configurazione-costi')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Riga configurazione_costi (core)' })
  configurazioneCosti(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantIdParam?: string,
  ) {
    return this.operative.getConfigurazioneCosti(
      this.tenantOf(req, tenantIdParam),
    );
  }

  @Post('prodotto-ingredienti-batch')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiBody({ type: BatchProductIdsDto })
  @ApiOperation({
    summary: 'Mappa prodotto → ingredienti (come getProductIngredientiBatch)',
  })
  async prodottoIngredientiBatch(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantIdParam: string | undefined,
    @Body() body: BatchProductIdsDto,
  ) {
    return this.operative.batchProdottoIngredientiMerged(
      this.tenantOf(req, tenantIdParam),
      body.productIds,
    );
  }

  // --- Mutazioni cassa / ordini (JWT tenant + ruoli staff Nest) ---

  @Get('turni/aperto')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Turno cassa aperto per JWT user (tenant)' })
  turnoAperto(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantIdParam?: string,
  ) {
    return this.writes.turnoAperto(req.user, tenantIdParam);
  }

  @Post('turni/apri')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiBody({ type: TurniApriDto })
  @ApiOperation({ summary: 'Apre turno cassa sul punto vendita' })
  async turnoApri(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantIdParam: string | undefined,
    @Body() body: TurniApriDto,
  ) {
    return this.writes.turnoApri(req.user, tenantIdParam, body.puntoVenditaId);
  }

  @Post('turni/chiudi')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiBody({ type: TurniChiudiDto })
  @ApiOperation({
    summary: 'Chiude turno cassa con riconciliazione cassa fisica',
  })
  async turnoChiudi(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantIdParam: string | undefined,
    @Body() body: TurniChiudiDto,
  ) {
    return this.writes.turnoChiudi(
      req.user,
      tenantIdParam,
      body.fondoContatoEuro,
      body.incassoAttesoEuro ?? null,
      body.note ?? null,
    );
  }

  @Post('ordini')
  @HttpCode(201)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiBody({ type: CreateOrderDto })
  @ApiOperation({
    summary:
      'Crea ordine con righe (equivalente operativo RPC create_order_with_items)',
    description:
      'Controlli staff lato JWT; polygon delivery non rivalidato qui (solo utenti Nest staff).',
  })
  async createOrdine(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantIdParam: string | undefined,
    @Body() body: CreateOrderDto,
  ) {
    const id = await this.writes.createOrder(req.user, tenantIdParam, body);
    return { id };
  }

  @Get('ordini/:ordineId/dettaglio')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Ordine con righe' })
  getOrdineDettaglio(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantIdParam: string | undefined,
    @Param('ordineId', ParseUUIDPipe) ordineId: string,
  ) {
    return this.writes.getOrderDetail(req.user, tenantIdParam, ordineId);
  }

  @Patch('ordini/:ordineId/stato')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiBody({ type: UpdateOrderStatoDto })
  @ApiOperation({ summary: 'Aggiorna stato ordine' })
  async patchOrdineStato(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantIdParam: string | undefined,
    @Param('ordineId', ParseUUIDPipe) ordineId: string,
    @Body() body: UpdateOrderStatoDto,
  ) {
    await this.writes.updateOrderStato(
      req.user,
      tenantIdParam,
      ordineId,
      body.stato,
    );
  }

  @Patch('ordini/:ordineId/tipo-pagamento')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiBody({ type: UpdateOrderTipoPagamentoDto })
  async patchTipoPagamento(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantIdParam: string | undefined,
    @Param('ordineId', ParseUUIDPipe) ordineId: string,
    @Body() body: UpdateOrderTipoPagamentoDto,
  ) {
    await this.writes.updateOrderTipoPagamento(
      req.user,
      tenantIdParam,
      ordineId,
      body.tipoPagamento,
    );
  }

  @Patch('ordini/:ordineId')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiBody({ type: UpdateOrderPatchDto })
  @ApiOperation({
    summary: 'Patch campi ordine',
    description: 'Whitelist allineata a updateOrder Sul client pubblico.',
  })
  async patchOrdine(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantIdParam: string | undefined,
    @Param('ordineId', ParseUUIDPipe) ordineId: string,
    @Body() body: UpdateOrderPatchDto,
  ) {
    await this.writes.updateOrderPatch(req.user, tenantIdParam, ordineId, body);
  }

  @Put('ordini/:ordineId/righe')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiBody({ type: ReplaceOrderItemsDto })
  @ApiOperation({
    summary: 'Sostituisce righe ordine',
    description:
      'Equivalente operativo RPC replace_order_items (controlli via JWT Nest).',
  })
  async putOrdineRighe(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantIdParam: string | undefined,
    @Param('ordineId', ParseUUIDPipe) ordineId: string,
    @Body() body: ReplaceOrderItemsDto,
  ) {
    await this.writes.replaceOrderItems(
      req.user,
      tenantIdParam,
      ordineId,
      body,
    );
  }

  @Get('ruoli-pizzeria')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Elenco ruoli tenant (fallback da core.users se vista ruoli_pizzeria assente Sul client)',
  })
  listRuoliPizzeria(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantIdParam?: string,
  ) {
    return this.writes.listRuoliPizzeriaCore(req.user, tenantIdParam);
  }

  @Post('righe/aggregate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiBody({ type: RigheAggregateDto })
  @ApiOperation({ summary: 'Somma quantità righe per elenco ordini' })
  righeAggregate(
    @Req() req: { user: JwtUser },
    @Query('tenantId') tenantIdParam: string | undefined,
    @Body() body: RigheAggregateDto,
  ) {
    return this.writes.righeAggregate(req.user, tenantIdParam, body.ordineIds);
  }
}
