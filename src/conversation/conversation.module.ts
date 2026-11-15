import { Module } from '@nestjs/common';
import { AnswerModule } from '../answer/answer.module';
import { QuestionnaireModule } from '../questionnaire/questionnaire.module';
import { RulesModule } from '../rules/rules.module';
import { SessionModule } from '../session/session.module';
import { ConversationService } from './conversation.service';

@Module({
  imports: [QuestionnaireModule, RulesModule, SessionModule, AnswerModule],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule {}
