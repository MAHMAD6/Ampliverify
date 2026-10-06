import { ArrayNotEmpty, IsArray, IsString, MaxLength } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  @MaxLength(120)
  key: string;

  @IsString()
  @MaxLength(160)
  name: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  permissionKeys: string[];
}
