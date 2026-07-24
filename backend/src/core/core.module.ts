import { Module } from "@nestjs/common";
import { CoreController } from "./core.controller";
import { AdminController } from "./admin.controller";
import { CoreService } from "./core.service";
import { PcfmsService } from "./pcfms.service";

@Module({
  controllers: [CoreController, AdminController],
  providers: [CoreService, PcfmsService],
  exports: [CoreService],
})
export class CoreModule {}
