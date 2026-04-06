import { Calendar, MapPin, Link as LinkIcon } from 'lucide-react';

export default function ProfilePage({ params }: { params: { username: string } }) {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      {/* Cover Photo */}
      <div className="h-48 w-full bg-gradient-to-r from-primary/40 to-blue-500/40"></div>
      
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="relative -mt-16 sm:-mt-24 mb-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-6">
            <div className="h-32 w-32 rounded-full border-4 border-background bg-card flex items-center justify-center text-4xl font-bold text-muted shadow-sm">
              {params.username[0].toUpperCase()}
            </div>
            <div className="pb-2">
              <h1 className="text-3xl font-bold text-foreground">{params.username}</h1>
              <p className="text-muted">@frontend_dev</p>
            </div>
          </div>
          <div className="pb-2 flex gap-3">
            <button className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors">
              Follow
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Left Column: Info */}
          <div className="w-full md:w-1/3 space-y-6">
            <div className="rounded-xl bg-card p-5 shadow-sm border border-border/50 space-y-4">
              <p className="text-sm text-foreground">Passionate developer building clean and light user interfaces.</p>
              <div className="space-y-2 text-sm text-muted">
                <div className="flex items-center gap-2"><MapPin className="h-4 w-4" /> San Francisco, CA</div>
                <div className="flex items-center gap-2"><LinkIcon className="h-4 w-4" /> <a href="#" className="text-primary hover:underline">github.com</a></div>
                <div className="flex items-center gap-2"><Calendar className="h-4 w-4" /> Joined April 2026</div>
              </div>
              <div className="flex gap-4 pt-4 border-t border-border">
                <div><span className="font-bold text-foreground">42</span> <span className="text-muted text-sm">Followers</span></div>
                <div><span className="font-bold text-foreground">12</span> <span className="text-muted text-sm">Following</span></div>
              </div>
            </div>
          </div>

          {/* Right Column: Content Tabs */}
          <div className="w-full md:w-2/3">
            <div className="border-b border-border mb-6">
              <nav className="-mb-px flex space-x-8">
                <a href="#" className="border-primary text-primary whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium">Posts (12)</a>
                <a href="#" className="border-transparent text-muted hover:border-border hover:text-foreground whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium">Comments (48)</a>
                <a href="#" className="border-transparent text-muted hover:border-border hover:text-foreground whitespace-nowrap border-b-2 py-4 px-1 text-sm font-medium">Upvoted</a>
              </nav>
            </div>
            
            {/* Mock Post List */}
            <div className="space-y-4">
              <div className="rounded-xl bg-card p-5 shadow-sm border border-border/50 transition-shadow hover:shadow-md cursor-pointer">
                <h2 className="text-lg font-bold text-foreground mb-2">My journey learning Next.js App Router</h2>
                <p className="text-sm text-muted mb-4 line-clamp-2">It was challenging at first, but understanding Server Components changed everything.</p>
                <div className="flex items-center text-xs text-muted gap-4">
                  <span>Technology</span>
                  <span>•</span>
                  <span>3 days ago</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
