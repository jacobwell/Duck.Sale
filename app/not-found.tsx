import Link from "next/link";
export default function NotFound() {
  return (
    <main className="error-page">
      <h1>Nothing at these coordinates.</h1>
      <p>This page could not be found.</p>
      <Link className="primary" href="/">
        Back to Boatduck
      </Link>
    </main>
  );
}
