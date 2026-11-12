import { Module } from '@nestjs/common';
import { QuestionnaireModule } from '../questionnaire/questionnaire.module';
import { RulesModule } from '../rules/rules.module';
import { SessionModule } from '../session/session.module';
import { ConversationService } from './conversation.service';

@Module({
  imports: [QuestionnaireModule, RulesModule, SessionModule],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule {}
