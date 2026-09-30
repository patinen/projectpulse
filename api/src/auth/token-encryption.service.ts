import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

@Injectable()
export class TokenEncryptionService {
  constructor(private readonly configService: ConfigService) {}

  private getEncryptionKey(): Buffer {
    const keyBase64 = this.configService.get<string>('GITHUB_TOKEN_ENCRYPTION_KEY');

    if (!keyBase64) {
      throw new Error('GITHUB_TOKEN_ENCRYPTION_KEY is required');
    }

    const key = Buffer.from(keyBase64, 'base64');

    if (key.length !== 32) {
      throw new Error('GITHUB_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes');
    }

    return key;
  }

  encrypt(token: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.getEncryptionKey(), iv);
    const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return ['v1', iv.toString('base64'), authTag.toString('base64'), ciphertext.toString('base64')].join(':');
  }

  decrypt(serializedToken: string): string {
    const [version, ivBase64, authTagBase64, ciphertextBase64] = serializedToken.split(':');

    if (version !== 'v1' || !ivBase64 || !authTagBase64 || !ciphertextBase64) {
      throw new Error('Invalid encrypted token format');
    }

    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    const ciphertext = Buffer.from(ciphertextBase64, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.getEncryptionKey(), iv);

    decipher.setAuthTag(authTag);

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }
}
