// Admin modules from section 6 of the project documentation (A-01 to A-20).
export interface AdminModule {
  id: string
  path: string
  label: string
  summary: string
}

export interface AdminModuleGroup {
  title: string
  modules: AdminModule[]
}

export const MODULE_GROUPS: AdminModuleGroup[] = [
  {
    title: 'Overview',
    modules: [
      {
        id: 'A-01',
        path: '',
        label: 'Dashboard',
        summary:
          'Today, 7-day and 30-day sales, order count, average order value, prepaid vs COD split, top 10 products, low-stock list.',
      },
    ],
  },
  {
    title: 'Catalog',
    modules: [
      {
        id: 'A-02 · A-03 · A-04',
        path: 'products',
        label: 'Products',
        summary:
          'Create and edit products, size × colour variant matrix with SKU and stock, CSV import and export, bulk price and status change.',
      },
      {
        id: 'A-05',
        path: 'categories',
        label: 'Categories',
        summary: 'Nested tree (Men > Tank Tops), image, slug, sort order, show or hide.',
      },
      {
        id: 'A-06',
        path: 'price-stores',
        label: 'Price stores',
        summary: 'Define a store by fixed price (599, 699); products join by tag or by price rule.',
      },
      {
        id: 'A-07',
        path: 'inventory',
        label: 'Inventory',
        summary: 'Stock per variant, low-stock threshold, manual adjustment with reason, stock history.',
      },
    ],
  },
  {
    title: 'Sales',
    modules: [
      {
        id: 'A-08 · A-09',
        path: 'orders',
        label: 'Orders',
        summary:
          'Filterable order list and detail; confirm, pack, create shipment, print label and invoice, mark shipped, cancel, handle RTO.',
      },
      {
        id: 'A-10',
        path: 'returns',
        label: 'Returns',
        summary: 'Approve or reject requests, schedule reverse pickup, quality check result, restock, trigger refund.',
      },
      {
        id: 'A-11',
        path: 'payments',
        label: 'Payments',
        summary: 'Transaction list, gateway status, refund initiation (owner only), COD remittance reconciliation.',
      },
      {
        id: 'A-15',
        path: 'customers',
        label: 'Customers',
        summary: 'Search by phone or order number, order history, addresses, notes, block for COD abuse.',
      },
    ],
  },
  {
    title: 'Marketing',
    modules: [
      {
        id: 'A-12',
        path: 'coupons',
        label: 'Coupons',
        summary: 'Code, percentage or flat, minimum bag value, max discount, usage limits, dates, first-order only, category restrictions.',
      },
      {
        id: 'A-13',
        path: 'offers',
        label: 'Offers',
        summary: 'Bundle rule (buy N for ₹X from a collection), prepaid discount, COD fee, free-shipping threshold.',
      },
      {
        id: 'A-14',
        path: 'content',
        label: 'Content',
        summary: 'Announcement bar, home banners, category tiles, drawer menu tree, drawer promo image, static pages.',
      },
      {
        id: 'A-16',
        path: 'reviews',
        label: 'Reviews',
        summary: 'Approve, hide, reply.',
      },
      {
        id: 'A-17',
        path: 'bulk-enquiries',
        label: 'Bulk enquiries',
        summary: 'Inbox with status (new, contacted, won, lost) and notes.',
      },
    ],
  },
  {
    title: 'Business',
    modules: [
      {
        id: 'A-18',
        path: 'reports',
        label: 'Reports',
        summary: 'Sales, GST (HSN-wise), returns and RTO rate, coupon usage; export to CSV.',
      },
      {
        id: 'A-19',
        path: 'staff',
        label: 'Staff',
        summary: 'Staff accounts, roles, 2FA, audit log viewer.',
      },
      {
        id: 'A-20',
        path: 'settings',
        label: 'Settings',
        summary:
          'Store details, GSTIN, invoice series, payment gateway keys, courier keys, SMS and WhatsApp templates, serviceable pincodes.',
      },
    ],
  },
]

export const MODULES = MODULE_GROUPS.flatMap((group) => group.modules)
