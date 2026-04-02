import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
}

export function Breadcrumb({ items }: BreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1.5 text-sm">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={13} className="text-[#4A4A48]" />}
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="text-[#8A8A85] hover:text-[#F5F5F0] transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? 'text-[#F5F5F0] font-medium' : 'text-[#8A8A85]'}>
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
