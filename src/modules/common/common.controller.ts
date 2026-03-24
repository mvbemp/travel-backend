import { Controller, Get, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CommonService } from "./common.service";

@ApiTags('Common')
@ApiBearerAuth()
@Controller('common')
@UseGuards(JwtAuthGuard)
export class CommonController { 
    constructor(private service: CommonService)
    {}

    @Get('/expenses')
    expenses(){
        return this.service.getExpenses()
    }
}