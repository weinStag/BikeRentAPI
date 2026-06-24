import { Test, TestingModule } from '@nestjs/testing';
import { TypeResolver } from 'src/type/type.resolver';
import { TypeRepository } from 'src/type/repository/type.repository';

describe('TypeResolver', () => {
  let resolver: TypeResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TypeResolver,
        { provide: TypeRepository, useValue: { add: jest.fn(), find: jest.fn(), list: jest.fn(), remove: jest.fn(), update: jest.fn() } },
      ],
    }).compile();

    resolver = module.get<TypeResolver>(TypeResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
