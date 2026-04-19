import { Controller, Post, Get, Delete, Body, Param, UseGuards, Request, ForbiddenException } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { LlmService } from "./llm.service";

@ApiTags("llm")
@Controller("llm")
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @Post("chat")
  chat(
    @Request() req: any,
    @Body() body: { message: string; conversationId?: string }
  ) {
    return this.llmService.chat(req.user.userId, body.message, body.conversationId);
  }

  @Get("conversations")
  getConversations(@Request() req: any) {
    return this.llmService.getConversations(req.user.userId);
  }

  @Get("conversations/all")
  getAllConversations(@Request() req: any) {
    return this.llmService.getAllConversationsAdmin(req.user.userId);
  }

  @Get("conversations/:id/messages")
  getMessages(@Request() req: any, @Param("id") id: string) {
    return this.llmService.getConversationMessages(req.user.userId, id);
  }

  @Get("conversations/:id/messages/admin")
  getMessagesAdmin(@Request() req: any, @Param("id") id: string) {
    return this.llmService.getConversationMessagesAdmin(req.user.userId, id);
  }

  @Get("memories")
  getMemories(@Request() req: any) {
    return this.llmService.getMemories(req.user.userId);
  }

  @Delete("memories/:id")
  deleteMemory(@Param("id") id: string) {
    return this.llmService.deleteMemory(id);
  }
}
