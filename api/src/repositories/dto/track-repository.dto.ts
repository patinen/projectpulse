import { IsBoolean, IsNotEmpty, IsString } from 'class-validator';

export class TrackRepositoryDto {
  @IsString()
  @IsNotEmpty()
  githubId: string;

  @IsString()
  @IsNotEmpty()
  owner: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsBoolean()
  private: boolean;

  @IsString()
  @IsNotEmpty()
  defaultBranch: string;
}
