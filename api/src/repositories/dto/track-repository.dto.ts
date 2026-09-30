import { IsNotEmpty, IsString } from 'class-validator';

export class TrackRepositoryDto {
  @IsString()
  @IsNotEmpty()
  githubId: string;
}
