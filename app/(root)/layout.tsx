import Link from "next/link";
import Image from "next/image";
import { ReactNode } from "react";
import { redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/actions/auth.action";

const Layout = async ({ children }: { children: ReactNode }) => {
  const isUserAuthenticated = await isAuthenticated();
  if (!isUserAuthenticated) redirect("/sign-in");

  return (
    <div className="root-layout">
      <nav className="flex items-center justify-between w-full py-2">
        <Link href="/" className="flex items-center gap-2 group">
          <Image src="/logo.svg" alt="PrepWise Logo" width={38} height={32} />
          <h2 className="text-primary-100 group-hover:text-white transition-colors">PrepWise</h2>
        </Link>

        <div className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/"
            className="text-sm font-medium text-light-100 hover:text-white transition-colors max-sm:hidden"
          >
            Dashboard
          </Link>
          <Link
            href="/interview"
            className="text-sm font-medium text-light-100 hover:text-white transition-colors max-sm:hidden"
          >
            Voice Interview
          </Link>
          <Link
            href="/resume-analyzer"
            className="flex items-center gap-1.5 text-sm font-medium text-light-100 hover:text-primary-200 transition-colors py-1.5 px-3 rounded-full bg-dark-200 border border-white/10 hover:border-primary-200/40"
          >
            <span>Resume & ATS</span>
            <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-primary-200 text-dark-100 uppercase tracking-wider">
              New
            </span>
          </Link>
        </div>
      </nav>

      {children}
    </div>
  );
};

export default Layout;
