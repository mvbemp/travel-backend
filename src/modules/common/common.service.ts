import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/core/prisma/prisma.service";

@Injectable()
export class CommonService {
    constructor(
        private prisma: PrismaService
    ){}

    async getExpenses(){
        const expenses = await this.prisma.expense.findMany({
            include: {
                currency: true
            }
        })
        return expenses;
    }

    async getCurrencies(){
        return this.prisma.currency.findMany({
            orderBy: [{ is_main: 'desc' }, { id: 'asc' }]
        });
    }
}