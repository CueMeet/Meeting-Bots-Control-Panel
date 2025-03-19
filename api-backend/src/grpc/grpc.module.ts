import { Global, Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { MICROSERVICES, PROTO_PACKAGES, PROTO_PATHS } from 'src/constants/grpc';
import { WorkerService } from './worker.service';
import { ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: MICROSERVICES.TRANSCRIPT_MANAGEMENT,
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: PROTO_PACKAGES.TRANSCRIPT_MANAGEMENT,
            protoPath: join(__dirname, PROTO_PATHS.TRANSCRIPT_MANAGEMENT),
            url: configService.get('grpc.workerBackendUrl'),
            loader: { keepCase: true },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [WorkerService],
  exports: [WorkerService],
})
export class GrpcModule {}
