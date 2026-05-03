import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator'

export class PublicMenuIngredientsDto {
  @IsUUID()
  tenantId!: string

  @IsArray()
  @ArrayMaxSize(300)
  @IsUUID('4', { each: true })
  productIds!: string[]
}
