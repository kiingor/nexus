'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutGrid, FlaskConical, Download, LogOut, BookOpen, ChevronRight, Sparkles, MessageSquare } from 'lucide-react';
import { getSupabaseClient as createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/Toast';

interface SidebarProps {
  user: { email?: string; full_name?: string } | null;
}

const navItems = [
  { href: '/', label: 'Produtos', icon: LayoutGrid, exact: true },
  { href: '/test', label: 'Testar', icon: FlaskConical, exact: false },
  { href: '/chats', label: 'Chats', icon: MessageSquare, exact: false },
  { href: '/learn', label: 'Aprender', icon: Sparkles, exact: false },
  { href: '/export', label: 'Exportar', icon: Download, exact: false },
];

function getInitials(email?: string, name?: string): string {
  if (name) {
    return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
  }
  return (email?.[0] ?? 'U').toUpperCase();
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const error = (msg: string) => toast(msg, 'error');

  const isActive = (href: string, exact: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  async function handleLogout() {
    const supabase = createClient();
    const { error: err } = await supabase.auth.signOut();
    if (err) { error('Erro ao sair'); return; }
    router.push('/login');
    router.refresh();
  }

  return (
    <aside
      className="fixed left-0 top-0 h-full w-[220px] flex flex-col z-30"
      style={{
        background: 'rgba(10,10,11,0.9)',
        backdropFilter: 'blur(24px)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Logo */}
      <div className="px-5 py-6 border-b border-white/5">
        <Link href="/" className="flex items-center gap-2 group">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'linear-gradient(135deg, #FF6B00, #FF9A3C)',
              boxShadow: '0 0 16px rgba(255,107,0,0.3)',
            }}
          >
            <BookOpen size={14} className="text-white" />
          </div>
          <span
            className="text-lg font-bold text-[#F5F5F0] tracking-tight"
            style={{ fontFamily: 'Syne, sans-serif' }}
          >
            Nexus<span className="text-[#FF6B00]">.</span>
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const active = isActive(href, exact);
          return (
            <Link
              key={href}
              href={href}
              className={`
                flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                transition-all duration-200 group relative
                ${active
                  ? 'text-[#FF6B00] bg-[rgba(255,107,0,0.1)]'
                  : 'text-[#8A8A85] hover:text-[#F5F5F0] hover:bg-white/5'
                }
              `}
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r-full"
                  style={{ background: '#FF6B00' }}
                />
              )}
              <Icon size={16} className={active ? 'text-[#FF6B00]' : 'text-[#4A4A48] group-hover:text-[#8A8A85]'} />
              {label}
              {active && <ChevronRight size={12} className="ml-auto text-[#FF6B00]" />}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-white/5">
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.03)' }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: 'rgba(255,107,0,0.15)', color: '#FF8533' }}
          >
            {getInitials(user?.email, user?.full_name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[#F5F5F0] truncate">
              {user?.full_name ?? user?.email?.split('@')[0] ?? 'Usuário'}
            </p>
            <p className="text-[10px] text-[#4A4A48] truncate">{user?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="text-[#4A4A48] hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-red-500/10"
            title="Sair"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}
