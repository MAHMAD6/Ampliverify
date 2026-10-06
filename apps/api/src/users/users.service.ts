import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SyncUserDto } from '../auth/dto/sync-user.dto';

const PUBLIC_USER_FIELDS = {
  id: true,
  email: true,
  displayName: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  findByAuthSubject(authSubject: string) {
    return this.prisma.user.findUnique({ where: { authSubject } });
  }

  async findByIdOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: PUBLIC_USER_FIELDS });
    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found.' });
    }
    return user;
  }

  /** Provision or update the API user from the trusted auth service. */
  async syncAuthUser(dto: SyncUserDto) {
    const email = dto.email.trim();
    return this.prisma.$transaction(async (tx) => {
      const [bySubject, byEmail] = await Promise.all([
        tx.user.findUnique({ where: { authSubject: dto.authSubject } }),
        tx.user.findUnique({ where: { email } }),
      ]);

      if (byEmail && byEmail.authSubject !== dto.authSubject) {
        throw new ConflictException({
          code: 'AUTH_EMAIL_CONFLICT',
          message: 'This email is already linked to another authentication subject.',
        });
      }

      if (!bySubject) {
        const created = await tx.user.create({
          data: {
            authSubject: dto.authSubject,
            email,
            displayName: dto.displayName ?? null,
            status: dto.status ?? UserStatus.ACTIVE,
          },
          select: PUBLIC_USER_FIELDS,
        });
        await this.audit.record(
          {
            action: 'user.provision',
            targetType: 'user',
            targetId: created.id,
            afterState: { email: created.email, status: created.status },
          },
          tx,
        );
        return created;
      }

      const updated = await tx.user.update({
        where: { id: bySubject.id },
        data: {
          email,
          ...(dto.displayName !== undefined && { displayName: dto.displayName }),
          ...(dto.status !== undefined && { status: dto.status }),
        },
        select: PUBLIC_USER_FIELDS,
      });
      if (updated.status !== bySubject.status || updated.email !== bySubject.email) {
        await this.audit.record(
          {
            action: 'user.sync',
            targetType: 'user',
            targetId: updated.id,
            beforeState: { email: bySubject.email, status: bySubject.status },
            afterState: { email: updated.email, status: updated.status },
          },
          tx,
        );
      }
      return updated;
    });
  }

  listAll(limit = 100) {
    return this.prisma.user.findMany({
      select: PUBLIC_USER_FIELDS,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 500),
    });
  }
}
