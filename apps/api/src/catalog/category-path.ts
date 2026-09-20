interface CategoryWithParent {
  slug: string;
  parent?: { slug: string } | null;
}

// Categories nest one level (Men > Tank Tops) and the URL mirrors it: men/tank-tops
export function categoryPath(category: CategoryWithParent): string {
  return category.parent
    ? `${category.parent.slug}/${category.slug}`
    : category.slug;
}
