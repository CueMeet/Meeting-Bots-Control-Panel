import {
  PutObjectCommand,
  PutObjectCommandInput,
  S3,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
@Injectable()
export class AwsService {
  private readonly s3: S3;

  constructor(readonly configService: ConfigService) {
    this.s3 = new S3({
      credentials: {
        accessKeyId: this.configService.get('aws.accessKey'),
        secretAccessKey: this.configService.get('aws.secretKey'),
      },
      region: this.configService.get('aws.bucketRegion'),
    });
  }

  async generatePresignedUrlToUpload(
    objectName: string,
    contentType = 'audio/opus',
    metadata?: Record<string, string>,
    expiration?: number,
  ): Promise<string | null> {
    if (!expiration) expiration = 8000;

    try {
      const input: PutObjectCommandInput = {
        Bucket: this.configService.get('aws.meetingBotBucketName'),
        Key: objectName,
        ContentType: contentType,
        Metadata: metadata,
      };

      console.log('generatePresignedUrlToUpload input:', input);

      const command = new PutObjectCommand(input);

      return getSignedUrl(this.s3, command, {
        expiresIn: expiration,
      });
    } catch (error) {
      console.error(
        `Failed to generate presigned URL for uploading object: ${error}`,
      );

      return null;
    }
  }
}
