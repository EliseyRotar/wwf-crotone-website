import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container section text-center">
      <h1 className="text-6xl md:text-8xl font-head text-wwf-green mb-4">404</h1>
      <p className="text-xl text-ink-2 mb-2">Page not found</p>
      <p className="text-ink-grey mb-8">The page you are looking for does not exist or has been moved.</p>
      <Link href="/" className="btn btn-primary">
        Back to home
      </Link>
    </div>
  );
}
