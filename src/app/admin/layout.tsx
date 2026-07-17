import { getSession } from "@/lib/auth";
import AdminNav from "@/components/admin/AdminNav";
import "@/app/globals.css";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  const themeScript = `(function(){try{var t=localStorage.getItem("theme");if(!t){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}if(t==="dark"){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark";}else{document.documentElement.style.colorScheme="light";}}catch(e){}})();`;

  if (!session) {
    return (
      <html lang="it" suppressHydrationWarning>
        <head>
          <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        </head>
        <body className="bg-sand min-h-screen flex items-center justify-center p-6">
          {children}
        </body>
      </html>
    );
  }

  return (
    <html lang="it" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="bg-sand min-h-screen">
        <div className="flex min-h-screen">
          <AdminNav session={session} />
          <main className="flex-1 p-6 lg:p-10 overflow-x-auto min-w-0">{children}</main>
        </div>
      </body>
    </html>
  );
}