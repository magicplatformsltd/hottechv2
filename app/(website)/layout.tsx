import { getSiteSettings } from "@/lib/data";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { ReactiveBackground } from "@/components/layout/reactive-background";

export default async function WebsiteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = await getSiteSettings();

  return (
    <>
      <ReactiveBackground />
      <Navbar settings={settings} />
      <main className="min-h-screen pt-20">{children}</main>
      <Footer config={settings?.footer_config ?? null} settings={settings} />
    </>
  );
}
