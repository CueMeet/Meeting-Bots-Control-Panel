import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { User } from 'src/database/models/user.model';
import { CreateUserDto } from 'src/dto/user/create-user.dto';
@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User)
    private userModel: typeof User,
  ) {}

  async createUser(user: CreateUserDto) {
    return this.userModel.create(user);
  }

  async findUserByEmail(email: string) {
    return this.userModel.findOne({ where: { email } });
  }
}
