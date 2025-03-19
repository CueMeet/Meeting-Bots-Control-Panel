import { IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO for listing API keys for a user
 */
export class ListApiKeysDto {
  /**
   * The ID of the user whose API keys to list
   */
  @IsNotEmpty()
  @IsString()
  userId: string;
}
