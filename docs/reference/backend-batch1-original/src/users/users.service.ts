import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from '../db/entities';
import { SyncUserDto } from '../auth/dto/sync-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
  ) {}

  findByAuthSubject(authSubject: string) {
    return this.users.findOne({ where: { authSubject } });
  }

  findById(id: string) {
    return this.users.findOne({ where: { id } });
  }

  async findByIdOrThrow(id: string) {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found.' });
    }
    return user;
  }

  async syncAuthUser(dto: SyncUserDto) {
    const [bySubject, byEmail] = await Promise.all([
      this.users.findOne({ where: { authSubject: dto.authSubject } }),
      this.users.findOne({ where: { email: dto.email } }),
    ]);

    if (byEmail && byEmail.authSubject !== dto.authSubject) {
      throw new ConflictException({
        code: 'AUTH_EMAIL_CONFLICT',
        message: 'This email is already linked to another authentication subject.',
      });
    }

    const user = bySubject ?? this.users.create();
    user.authSubject = dto.authSubject;
    user.email = dto.email;
    if (dto.displayName !== undefined) user.displayName = dto.displayName;
    else if (!bySubject) user.displayName = null;
    if (dto.status !== undefined) user.status = dto.status;
    else if (!bySubject) user.status = UserStatus.ACTIVE;

    return this.users.save(user);
  }

  listAll() {
    return this.users.find({
      select: ['id', 'email', 'displayName', 'status', 'createdAt', 'updatedAt'],
      order: { createdAt: 'DESC' },
    });
  }
}
