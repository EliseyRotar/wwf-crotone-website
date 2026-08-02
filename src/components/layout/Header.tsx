import ScrollHeader from "@/components/layout/ScrollHeader";
import MobileMenu from "@/components/layout/MobileMenu";

export default function Header() {
  return (
    <>
      <a href="#main" className="skip-link">Vai al contenuto</a>
      <header
        className="sticky top-0 z-40"
        style={{ height: "var(--header-h)" }}
      >
        <ScrollHeader rightSlot={<MobileMenu />} />
      </header>
    </>
  );
}
