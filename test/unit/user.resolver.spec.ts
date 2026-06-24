import { Test, TestingModule } from '@nestjs/testing';
import { UserResolver } from 'src/user/user.resolver';
import { UserRepository } from 'src/user/repository/user.repository';
import { CryptService } from 'src/crypt/crypt.service';
import { RentRepository } from 'src/rent/repository/rent.repository';
import { DuplicateUserError } from 'src/errors/duplicate-user-error';
import { UserNotFoundError } from 'src/errors/user-not-found-error';
import { WrongPasswordError } from 'src/errors/wrong-password-error';
import { UserHasOpenRent } from 'src/errors/user-has-open-rent';
import { userSchema } from 'src/user/schema/user.schema';
import { userInput } from 'src/user/input/user.input';

/**
 * Test suite for UserResolver
 *
 * All dependencies (UserRepository, CryptService, RentRepository) are replaced
 * by Test Doubles (jest mocks), isolating the resolver's business-rule logic.
 */
describe('UserResolver', () => {
  let resolver: UserResolver;
  let userRepository: jest.Mocked<UserRepository>;
  let crypt: jest.Mocked<CryptService>;
  let rentRepository: jest.Mocked<RentRepository>;

  const fakeUser = (): Partial<userSchema> => ({
    id: 'user-1',
    name: 'John Doe',
    email: 'john@example.com',
    password: 'hashed-password',
    active: true,
    rg: '12345',
    address: 'Rua X',
    phone: '9999-9999',
  });

  beforeEach(async () => {
    const userRepoMock: Partial<jest.Mocked<UserRepository>> = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      add: jest.fn(),
      removeByEmail: jest.fn(),
      list: jest.fn(),
    };

    const cryptMock: Partial<jest.Mocked<CryptService>> = {
      encrypt: jest.fn(),
      compare: jest.fn(),
    };

    const rentRepoMock: Partial<jest.Mocked<RentRepository>> = {
      findOpenRentsFor: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserResolver,
        { provide: UserRepository, useValue: userRepoMock },
        { provide: CryptService, useValue: cryptMock },
        { provide: RentRepository, useValue: rentRepoMock },
      ],
    }).compile();

    resolver = module.get<UserResolver>(UserResolver);
    userRepository = module.get(UserRepository);
    crypt = module.get(CryptService);
    rentRepository = module.get(RentRepository);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // registerUser
  // ═══════════════════════════════════════════════════════════════════════════
  describe('registerUser', () => {
    it('should throw DuplicateUserError when the e-mail is already registered', async () => {
      (userRepository.findByEmail as jest.Mock).mockResolvedValue(fakeUser());

      const input = { email: 'john@example.com', password: 'secret' } as userInput;
      await expect(resolver.registerUser(input)).rejects.toThrow(DuplicateUserError);
    });

    it('should NOT save the user when the e-mail is already registered', async () => {
      (userRepository.findByEmail as jest.Mock).mockResolvedValue(fakeUser());

      const input = { email: 'john@example.com', password: 'secret' } as userInput;
      await expect(resolver.registerUser(input)).rejects.toThrow();
      expect(userRepository.add).not.toHaveBeenCalled();
    });

    it('should hash the password before saving a new user', async () => {
      (userRepository.findByEmail as jest.Mock).mockResolvedValue(null);
      (crypt.encrypt as jest.Mock).mockResolvedValue('$2b$10$hashedValue');
      (userRepository.add as jest.Mock).mockResolvedValue(undefined);

      const input = { email: 'new@example.com', password: 'plaintext' } as userInput;
      await resolver.registerUser(input);

      expect(crypt.encrypt).toHaveBeenCalledWith('plaintext');
      expect(input.password).toBe('$2b$10$hashedValue');
    });

    it('should persist the user with the hashed password when e-mail is new', async () => {
      (userRepository.findByEmail as jest.Mock).mockResolvedValue(null);
      (crypt.encrypt as jest.Mock).mockResolvedValue('hashed');
      (userRepository.add as jest.Mock).mockResolvedValue(undefined);

      const input = { email: 'new@example.com', password: 'plaintext' } as userInput;
      await resolver.registerUser(input);

      expect(userRepository.add).toHaveBeenCalledTimes(1);
      expect(userRepository.add).toHaveBeenCalledWith(expect.objectContaining({ password: 'hashed' }));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // AuthenticateUser
  // ═══════════════════════════════════════════════════════════════════════════
  describe('AuthenticateUser', () => {
    it('should throw UserNotFoundError when e-mail does not exist', async () => {
      (userRepository.findByEmail as jest.Mock).mockResolvedValue(null);

      await expect(resolver.AuthenticateUser('ghost@example.com', '123'))
        .rejects.toThrow(UserNotFoundError);
    });

    it('should throw WrongPasswordError when password does not match', async () => {
      (userRepository.findByEmail as jest.Mock).mockResolvedValue(fakeUser());
      (crypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(resolver.AuthenticateUser('john@example.com', 'wrong-password'))
        .rejects.toThrow(WrongPasswordError);
    });

    it('should return the user when credentials are correct', async () => {
      const user = fakeUser();
      (userRepository.findByEmail as jest.Mock).mockResolvedValue(user);
      (crypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await resolver.AuthenticateUser('john@example.com', 'correct-password');

      expect(result).toBe(user);
    });

    it('should compare the plain password against the stored hash', async () => {
      const user = fakeUser();
      (userRepository.findByEmail as jest.Mock).mockResolvedValue(user);
      (crypt.compare as jest.Mock).mockResolvedValue(true);

      await resolver.AuthenticateUser('john@example.com', 'my-plain-pass');

      expect(crypt.compare).toHaveBeenCalledWith('my-plain-pass', user.password);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // removeUserByEmail
  // ═══════════════════════════════════════════════════════════════════════════
  describe('removeUserByEmail', () => {
    it('should throw UserNotFoundError when user does not exist', async () => {
      (userRepository.findByEmail as jest.Mock).mockResolvedValue(null);

      await expect(resolver.removeUserByEmail('ghost@example.com'))
        .rejects.toThrow(UserNotFoundError);
    });

    it('should throw UserHasOpenRent when the user has at least one open rental', async () => {
      (userRepository.findByEmail as jest.Mock).mockResolvedValue(fakeUser());
      (rentRepository.findOpenRentsFor as jest.Mock).mockResolvedValue([{ id: 'rent-1' }]);

      await expect(resolver.removeUserByEmail('john@example.com'))
        .rejects.toThrow(UserHasOpenRent);
    });

    it('should NOT delete the user when they have open rentals', async () => {
      (userRepository.findByEmail as jest.Mock).mockResolvedValue(fakeUser());
      (rentRepository.findOpenRentsFor as jest.Mock).mockResolvedValue([{ id: 'rent-1' }]);

      await expect(resolver.removeUserByEmail('john@example.com')).rejects.toThrow();
      expect(userRepository.removeByEmail).not.toHaveBeenCalled();
    });

    it('should delete the user when they have no open rentals', async () => {
      (userRepository.findByEmail as jest.Mock).mockResolvedValue(fakeUser());
      (rentRepository.findOpenRentsFor as jest.Mock).mockResolvedValue([]);
      (userRepository.removeByEmail as jest.Mock).mockResolvedValue(undefined);

      await resolver.removeUserByEmail('john@example.com');

      expect(userRepository.removeByEmail).toHaveBeenCalledWith('john@example.com');
    });
  });
});

