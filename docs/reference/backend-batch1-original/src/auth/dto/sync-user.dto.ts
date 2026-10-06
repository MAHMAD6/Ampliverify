import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { UserStatus } from '../../db/entities';

export class SyncUserDto {
  @IsString()
  @MaxLength(191)
  authSubject: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  displayName?: string;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}
