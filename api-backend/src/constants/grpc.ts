import { protobufPackage } from 'src/interfaces/proto-generated/transcript_management';

export const enum MICROSERVICES {
  TRANSCRIPT_MANAGEMENT = 'TRANSCRIPT_MANAGEMENT',
}

export const PROTO_PACKAGES = {
  TRANSCRIPT_MANAGEMENT: protobufPackage,
};

export const PROTO_PATHS = {
  TRANSCRIPT_MANAGEMENT: '../../src/proto/transcript_management.proto',
};
