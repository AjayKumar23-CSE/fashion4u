import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { AuthStaff } from '../../auth/staff.js';
import { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AuditService } from '../audit.service.js';
import { slugify } from '../slug.js';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto.js';

@Injectable()
export class AdminCategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // Flat list, parents before children, including hidden categories.
  async list() {
    const categories = await this.prisma.category.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { products: true, children: true } } },
    });

    const roots = categories.filter((c) => !c.parentId);
    return roots.flatMap((root) => [
      root,
      ...categories.filter((c) => c.parentId === root.id),
    ]);
  }

  async create(dto: CreateCategoryDto, staff: AuthStaff) {
    await this.assertValidParent(dto.parentId ?? null);

    return this.write(() =>
      this.prisma.$transaction(async (tx) => {
        const category = await tx.category.create({
          data: {
            name: dto.name,
            slug: dto.slug ?? slugify(dto.name),
            parentId: dto.parentId,
            image: dto.image,
            sizeChart: dto.sizeChart,
            blurb: dto.blurb,
            sortOrder: dto.sortOrder,
            isActive: dto.isActive,
            showOnHome: dto.showOnHome,
          },
        });
        await this.audit.log(
          {
            staffId: staff.id,
            entity: 'category',
            entityId: category.id,
            action: 'create',
            after: category,
          },
          tx,
        );
        return category;
      }),
    );
  }

  async update(id: string, dto: UpdateCategoryDto, staff: AuthStaff) {
    const before = await this.get(id);
    if (dto.parentId !== undefined) {
      await this.assertValidParent(dto.parentId, before.id);
    }

    return this.write(() =>
      this.prisma.$transaction(async (tx) => {
        const category = await tx.category.update({ where: { id }, data: dto });
        await this.audit.log(
          {
            staffId: staff.id,
            entity: 'category',
            entityId: id,
            action: 'update',
            before,
            after: category,
          },
          tx,
        );
        return category;
      }),
    );
  }

  async remove(id: string, staff: AuthStaff) {
    const before = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { products: true, children: true } } },
    });
    if (!before) throw this.notFound();
    if (before._count.products > 0 || before._count.children > 0) {
      throw new ConflictException({
        code: 'CATEGORY_IN_USE',
        message:
          'Move or delete its products and sub-categories first, or hide the category instead',
      });
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.category.delete({ where: { id } });
      await this.audit.log(
        {
          staffId: staff.id,
          entity: 'category',
          entityId: id,
          action: 'delete',
          before,
        },
        tx,
      );
    });
  }

  private async get(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) throw this.notFound();
    return category;
  }

  // The tree is one level deep (Men > Tank Tops): a parent must be a root, and
  // a category that has children cannot itself be moved under a parent.
  private async assertValidParent(parentId: string | null, selfId?: string) {
    if (!parentId) return;

    const invalid = (message: string) =>
      new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        fields: { parentId: [message] },
      });

    if (parentId === selfId)
      throw invalid('A category cannot be its own parent');
    const parent = await this.prisma.category.findUnique({
      where: { id: parentId },
    });
    if (!parent) throw invalid('Parent category not found');
    if (parent.parentId) throw invalid('Categories nest only one level deep');

    if (selfId) {
      const children = await this.prisma.category.count({
        where: { parentId: selfId },
      });
      if (children > 0) {
        throw invalid(
          'This category has sub-categories, so it must stay top-level',
        );
      }
    }
  }

  // Slugs are unique among siblings.
  private async write<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'SLUG_TAKEN',
          message: 'Another category at this level already uses that slug',
          fields: { slug: ['Already in use'] },
        });
      }
      throw error;
    }
  }

  private notFound() {
    return new NotFoundException({
      code: 'CATEGORY_NOT_FOUND',
      message: 'Category not found',
    });
  }
}
