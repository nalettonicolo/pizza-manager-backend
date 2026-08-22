import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class CreateOrderItemDto {
  @IsUUID()
  prodotto_id!: string;

  @IsNumber()
  quantita!: number;

  @IsNumber()
  prezzo!: number;

  @IsOptional()
  @IsString()
  formato_nome?: string | null;

  @IsOptional()
  @IsString()
  ingredienti_cottura_summary?: string | null;
}

export class CreateOrderDto {
  @IsNumber()
  totale!: number;

  @IsOptional()
  @IsString()
  stato?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @IsOptional()
  @IsString()
  note?: string | null;

  @IsOptional()
  @IsString()
  tipo_pagamento?: string | null;

  @IsOptional()
  @IsString()
  tipo_ordine?: string | null;

  @IsOptional()
  @IsString()
  nome_cliente?: string | null;

  @IsOptional()
  @IsString()
  orario_ritiro?: string | null;

  @IsOptional()
  @IsString()
  indirizzo_consegna?: string | null;

  @IsOptional()
  @IsNumber()
  consegna_lng?: number | null;

  @IsOptional()
  @IsNumber()
  consegna_lat?: number | null;

  @IsOptional()
  @IsObject()
  pagamento_dettaglio?: Record<string, unknown> | null;

  @IsOptional()
  @IsUUID()
  punto_vendita_id?: string | null;

  @IsOptional()
  @IsInt()
  turno_operatori_id?: number | null;

  @IsOptional()
  @IsString()
  telefono_ritiro?: string | null;
}
