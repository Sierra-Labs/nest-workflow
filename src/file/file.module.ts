import { Module } from '@nestjs/common';
import { FileController } from './file.controller';
import { FileService } from './file.service';
import { AuthService } from '@sierralabs/nest-identity';

@Module({
  controllers: [FileController],
  providers: [FileService, AuthService],
})
export class FileModule {}
