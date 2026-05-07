import React from 'react';
import { 
  Home, BarChart2, Users, ShoppingCart, 
  Briefcase, Calendar, FileText, Box, 
  Megaphone, Truck 
} from 'lucide-react';


export interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
  children?: NavItem[];
}

export const NAVIGATION_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <Home size={20} />,
    path: '/dashboard'
  },
  {
    id: 'tables',
    label: 'Tables',
    icon: <BarChart2 size={20} />,
    path: '/tables',
    children: [
      { id: 'leads', label: 'Leads', icon: <BarChart2 size={18} />, path: '/tables/leads' },
      { id: 'contacts', label: 'Contacts', icon: <Users size={18} />, path: '/tables/contacts' },
      { id: 'orders', label: 'Orders', icon: <ShoppingCart size={18} />, path: '/tables/orders' },
      { id: 'tasks', label: 'Tasks', icon: <Briefcase size={18} />, path: '/tables/tasks' },
      { id: 'meetings', label: 'Meetings', icon: <Calendar size={18} />, path: '/tables/meetings' },
      { id: 'invoices', label: 'Invoices', icon: <FileText size={18} />, path: '/tables/invoices' },
      { id: 'products', label: 'Products', icon: <Box size={18} />, path: '/tables/products' },
      { id: 'campaigns', label: 'Campaigns', icon: <Megaphone size={18} />, path: '/tables/campaigns' },
      { id: 'vendors', label: 'Vendors', icon: <Truck size={18} />, path: '/tables/vendors' },
    ]
  },

  {
    id: 'contacts',
    label: 'People',
    icon: <Users size={20} />,
    path: '/contacts'
  },
  {
    id: 'orders',
    label: 'History',
    icon: <ShoppingCart size={20} />,
    path: '/orders'
  }
];

// Placeholder for architecture scaffolding
export const NAV_ITEMS = [];
