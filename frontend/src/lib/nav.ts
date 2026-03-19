import { LayoutDashboard, Wallet, ArrowLeftRight, Target, Tag, Inbox } from 'lucide-react'

export const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'Accounts', href: '/accounts', icon: Wallet },
    { label: 'Transactions', href: '/transactions', icon: ArrowLeftRight },
    { label: 'Budgets', href: '/budgets', icon: Target },
    { label: 'Categories', href: '/categories', icon: Tag },
    { label: 'Inbox', href: '/inbox', icon: Inbox },
]
