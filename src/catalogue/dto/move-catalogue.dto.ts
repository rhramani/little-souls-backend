import { IsString, IsNotEmpty } from 'class-validator';

export class MoveCatalogueAsCategoryDto {
  @IsString()
  @IsNotEmpty()
  targetCatalogueId: string;
}
