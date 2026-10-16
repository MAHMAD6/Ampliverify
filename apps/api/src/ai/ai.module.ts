import { Global, Module } from '@nestjs/common';
import { AiGateService } from './ai-gate.service';
import { OpenAiService } from './openai.service';

@Global()
@Module({ providers: [OpenAiService, AiGateService], exports: [OpenAiService, AiGateService] })
export class AiModule {}
