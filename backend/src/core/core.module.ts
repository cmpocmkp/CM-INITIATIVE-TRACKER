import { Module } from "@nestjs/common";
import { CoreController } from "./core.controller";
import { AdminController } from "./admin.controller";
import { CoreService } from "./core.service";

@Module({
  controllers: [CoreController, AdminController],
  providers: [CoreService],
  exports: [CoreService],
})
export class CoreModule {}
