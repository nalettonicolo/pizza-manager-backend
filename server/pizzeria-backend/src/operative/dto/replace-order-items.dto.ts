import { Type } from 'class-transformer'
import { IsArray, IsNumber, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator'

export class ReplaceOrderLineDto {
  @IsUUID()
  prodotto_id!: string

  @IsNumber()
  quantita!: number

  @IsNumber()
  prezzo!: number

  @IsOptional()
  @IsString()
  formato_nome?: string | null

  @IsOptional()
  @IsString()
  ingredienti_cottura_summary?: string | null
}

export class ReplaceOrderItemsDto {
  @IsNumber()
  totale!: number

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReplaceOrderLineDto)
  items!: ReplaceOrderLineDto[]
}
