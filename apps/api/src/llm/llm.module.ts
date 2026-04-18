import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LlmService } from "./llm.service";
import { LlmController } from "./llm.controller";
import { ContextBuilderService } from "./context-builder.service";
import { ConversationEntity } from "./conversation.entity";
import { ChatMessageEntity } from "./chat-message.entity";
import { ConversationMemoryEntity } from "./conversation-memory.entity";
import { SettingsModule } from "../settings/settings.module";
import { TasksModule } from "../tasks/tasks.module";
import { ShoppingModule } from "../shopping/shopping.module";
import { CalendarModule } from "../calendar/calendar.module";
import { RecipesModule } from "../recipes/recipes.module";
import { UsersModule } from "../users/users.module";
import { MenuPlanModule } from "../menu-plan/menu-plan.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([ConversationEntity, ChatMessageEntity, ConversationMemoryEntity]),
    SettingsModule,
    TasksModule,
    ShoppingModule,
    CalendarModule,
    RecipesModule,
    UsersModule,
    MenuPlanModule,
  ],
  providers: [LlmService, ContextBuilderService],
  controllers: [LlmController],
  exports: [LlmService],
})
export class LlmModule {}
