import { Global, Module } from '@nestjs/common';
import { AiGateService } from './ai-gate.service';
import { ClaudeService } from './claude.service';

@Global()
@Module({ providers: [ClaudeService, AiGateService], exports: [ClaudeService, AiGateService] })
export class AiModule {}
