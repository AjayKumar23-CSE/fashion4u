import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

type Db = PrismaService | Prisma.TransactionClient;

interface AuditEntry {
  staffId: string;
  entity: string;
  entityId: string;
  action: 'create' | 'update' | 'delete';
  before?: unknown;
  after?: unknown;
}

// Every admin write is recorded with user, time, entity and before/after values.
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  // Pass the transaction client so the log commits or rolls back with the write.
  log(entry: AuditEntry, db: Db = this.prisma) {
    return db.auditLog.create({
      data: {
        staffUserId: entry.staffId,
        entity: entry.entity,
        entityId: entry.entityId,
        action: entry.action,
        before: toJson(entry.before),
        after: toJson(entry.after),
      },
    });
  }
}

function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined
    ? undefined
    : (JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue);
}
