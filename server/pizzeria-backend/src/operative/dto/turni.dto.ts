import { IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class TurniApriDto {
  @IsUUID()
  puntoVenditaId!: string;
}

export class TurniChiudiDto {
  @IsNumber()
  fondoContatoEuro!: number;

  @IsOptional()
  @IsNumber()
  incassoAttesoEuro?: number | null;

  @IsOptional()
  @IsString()
  note?: string | null;
}
