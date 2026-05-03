import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator'

export class BatchProductIdsDto {
  @IsArray()
  @ArrayMaxSize(400)
  @IsUUID('4', { each: true })
  productIds!: string[]
}
