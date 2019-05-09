import { INestApplication, Logger } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { UserController, UserService } from '@sierralabs/nest-identity';
import { AppModule } from '../../src/app.module';
import { UserMock } from './user.mock';
import { OrganizationMock } from './organization.mock';
import { Connection } from 'typeorm';
import { LocalstackMock } from './localstack.mock';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 120000;
describe('MockData', () => {
  const logger = new Logger('Mocks');
  const packageInfo = require('../../package.json');
  logger.log(
    `\nEnv     : ${process.env.NODE_ENV}\nVersion : ${packageInfo.version}`,
  );

  let app: INestApplication;
  let module: TestingModule;
  let userController: UserController;
  let userService: UserService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    userController = module.get<UserController>(UserController);
    userService = module.get<UserService>(UserService);

    userService.onModuleInit();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    // close the typeorm connection; otherwise jest won't quit
    const connection = app.get(Connection);
    await connection.close();
    await app.close();
  });

  describe('Load and Check Errors', () => {
    it('should not have mock organization errors', async () => {
      let error = null;
      try {
        const organizationOck = new OrganizationMock(module);
        await organizationOck.generate();
      } catch (err) {
        error = err;
        expect(err).toBeFalsy();
      }
      expect(error).toBeFalsy();
    });
    it('should not have mock user errors', async () => {
      let error = null;
      try {
        const userMock = new UserMock(module);
        await userMock.generate();
      } catch (err) {
        error = err;
        expect(err).toBeFalsy();
      }
      expect(error).toBeFalsy();
    });
    it('should not have mock localstack errors', async () => {
      let error = null;
      try {
        const localstackMock = new LocalstackMock(module);
        await localstackMock.generate();
      } catch (err) {
        error = err;
        expect(err).toBeFalsy();
      }
      expect(error).toBeFalsy();
    });
  });
});
