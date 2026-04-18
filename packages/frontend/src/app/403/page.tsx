import Link from 'next/link';
import { ShieldAlert, Home, LogIn } from 'lucide-react';
import { getDictionary } from '../../i18n/get-dictionary';
import { cookies, headers } from 'next/headers';
import { defaultLocale } from '../../i18n/config';

export default async function ForbiddenPage() {
  const cookieStore = await cookies();
  const headersStore = await headers();
  const locale = cookieStore.get('NEXT_LOCALE')?.value || headersStore.get('x-locale') || defaultLocale;
  // @ts-expect-error locale typing
  const dict = await getDictionary(locale);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground overflow-hidden relative selection:bg-primary/30">
      
      {/* Animated Background Gradients */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30 dark:opacity-20">
        <div className="absolute w-[500px] h-[500px] bg-red-500/20 dark:bg-red-500/10 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '4s' }}></div>
        <div className="absolute w-[400px] h-[400px] bg-orange-500/20 dark:bg-orange-500/10 rounded-full blur-[80px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }}></div>
      </div>

      <div className="relative z-10 max-w-md w-full p-8 mx-4 backdrop-blur-xl bg-card/60 dark:bg-card/40 border border-border/50 rounded-3xl shadow-2xl animate-in zoom-in-95 fade-in duration-500 slide-in-from-bottom-4">
        
        <div className="flex flex-col items-center text-center space-y-6">
          
          <div className="relative group">
            <div className="absolute -inset-4 bg-red-500/20 dark:bg-red-500/10 rounded-full blur-xl group-hover:bg-red-500/30 transition-all duration-500"></div>
            <div className="relative w-24 h-24 bg-red-100 dark:bg-red-950/50 rounded-2xl flex items-center justify-center transition-transform duration-500 shadow-inner">
              <ShieldAlert className="w-12 h-12 text-red-600 dark:text-red-500" aria-label={dict.forbidden?.lockIconAlt || "Access Denied"} />
            </div>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-black tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              {dict.forbidden?.title || "403 - Access Denied"}
            </h1>
            <p className="text-muted-foreground leading-relaxed">
              {dict.forbidden?.description || "Sorry, you don't have permission to access this page. This area is restricted to Super Admins."}
            </p>
          </div>

          <div className="w-full h-px bg-gradient-to-r from-transparent via-border to-transparent my-4"></div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full pt-2">
            <Link 
              href="/" 
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:scale-105 active:scale-95 transition-all duration-200 font-medium"
            >
              <Home className="w-4 h-4" />
              {dict.forbidden?.backToHome || "Back to Home"}
            </Link>
            
            <Link 
              href="/login" 
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all duration-200 font-medium shadow-md shadow-primary/20"
            >
              <LogIn className="w-4 h-4" />
              {dict.forbidden?.goToLogin || "Login Again"}
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
