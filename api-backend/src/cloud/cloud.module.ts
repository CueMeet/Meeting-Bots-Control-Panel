import { Module } from '@nestjs/common';
import { AwsModule } from 'src/aws/aws.module';
import { OvhModule } from 'src/ovh/ovh.module';
import { CloudService } from './cloud.service';

@Module({
  imports: [OvhModule, AwsModule],
  providers: [CloudService],
  exports: [CloudService],
})
export class CloudModule {}
