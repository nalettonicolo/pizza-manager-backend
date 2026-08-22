import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class UpdateOrderStatoDto {
  @IsString()
  stato!: string;
}

export class UpdateOrderTipoPagamentoDto {
  @IsString()
  tipoPagamento!: string;
}

export class UpdateOrderPatchDto {
  @IsOptional()
  @IsString()
  nome_cliente?: string | null;

  @IsOptional()
  @IsString()
  telefono_ritiro?: string | null;

  @IsOptional()
  @IsString()
  orario_ritiro?: string | null;

  @IsOptional()
  @IsString()
  note?: string | null;

  @IsOptional()
  @IsString()
  tipo_pagamento?: string | null;

  @IsOptional()
  @IsString()
  indirizzo_consegna?: string | null;

  @IsOptional()
  @IsString()
  tipo_ordine?: string | null;

  @IsOptional()
  @IsObject()
  pagamento_dettaglio?: Record<string, unknown> | null;

  @IsOptional()
  @IsString()
  stato_consegna?: string | null;

  @IsOptional()
  @IsNumber()
  consegna_lng?: number | null;

  @IsOptional()
  @IsNumber()
  consegna_lat?: number | null;

  @IsOptional()
  @IsUUID()
  punto_vendita_id?: string | null;
}

export class RigheAggregateDto {
  @IsArray()
  @IsString({ each: true })
  ordineIds!: string[];
}
