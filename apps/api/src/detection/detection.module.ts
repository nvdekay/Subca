import { Module } from '@nestjs/common';
import { DetectionService } from './detection.service.js';

/** Lọc ứng viên, parse email và đối soát thành subscription. Không biết Gmail là gì. */
@Module({
  providers: [DetectionService],
  exports: [DetectionService],
})
export class DetectionModule {}
